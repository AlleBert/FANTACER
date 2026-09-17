#!/usr/bin/env node
/**
 * Seed del load test su `fantacer-e2e`.
 *
 * - Legge da production (SOLO lettura) le aziende del batch attivo.
 * - Le importa in e2e (con `image_url` azzerato: nessun load sullo storage prod).
 * - Genera N `vote_sessions` sintetici (nessuna PII) con prefisso `seed-loadtest-`.
 * - Imposta `batch_settings.active_batch` al batch importato e salva lo stato
 *   precedente in `.loadtest/state.json` (usato da cleanup.mjs).
 *
 * Usage:
 *   npm run loadtest:seed
 *   npm run loadtest:seed -- --votes=100000 --run-id=lt01
 *   npm run loadtest:seed -- --batch=cersaie_14092026
 */
import { adminClient, countRows, fail, loadCreds, parseArgs, readState, SEED_PREFIX, writeState } from './lib.mjs'

const CHUNK = 500
const DEFAULT_VOTES = 100_000

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(`
Usage: npm run loadtest:seed [-- --batch=<batch> --votes=<n> --run-id=<id>]

  --batch=<batch>   batch di production da importare (default: active_batch di prod)
  --votes=<n>       numero di vote_sessions sintetici (default: ${DEFAULT_VOTES})
  --run-id=<id>     id del run usato dai fingerprint del load (default: generato)
  --help            questo messaggio
`)
  process.exit(0)
}

const votes = Number(args.votes ?? DEFAULT_VOTES)
if (!Number.isInteger(votes) || votes <= 0) fail(`--votes non valido: ${args.votes}`)

const { prod, e2e } = loadCreds()
const prodDb = adminClient(prod)
const e2eDb = adminClient(e2e)
const runId = args['run-id'] ? String(args['run-id']) : `lt${Date.now().toString(36)}`

function log(...a) {
  console.log('[seed]', ...a)
}

async function resolveBatch() {
  if (args.batch) return String(args.batch)
  const { data, error } = await prodDb.from('batch_settings').select('active_batch').eq('id', 'default').single()
  if (error || !data) fail(`Impossibile leggere active_batch da production: ${error?.message}`)
  return data.active_batch
}

async function importCompanies(batch) {
  const { data, error, count } = await prodDb
    .from('companies')
    .select('id, name, category, description, batch, created_at', { count: 'exact' })
    .eq('batch', batch)
    .order('name')
  if (error) fail(`Lettura companies da production: ${error.message}`)
  if (!data || data.length === 0) fail(`Nessuna company nel batch '${batch}' su production`)

  const rows = data.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    description: c.description,
    batch: c.batch,
    created_at: c.created_at,
    image_url: null,
    updated_at: new Date().toISOString(),
  }))

  const { error: upErr } = await e2eDb.from('companies').upsert(rows, { onConflict: 'id' })
  if (upErr) fail(`Upsert companies in e2e: ${upErr.message}`)
  log(`importate ${count} company del batch '${batch}' (image_url azzerato)`)
  return rows.map((r) => r.id)
}

function randomTriple(ids) {
  const a = Math.floor(Math.random() * ids.length)
  let b = Math.floor(Math.random() * (ids.length - 1))
  if (b >= a) b += 1
  let c = Math.floor(Math.random() * (ids.length - 2))
  const excludes = [a, b].sort((x, y) => x - y)
  for (const e of excludes) if (c >= e) c += 1
  return [ids[a], ids[b], ids[c]]
}

async function seedVotes(ids) {
  const existing = await countRows(e2eDb, 'vote_sessions', (q) => q.like('fingerprint', `${SEED_PREFIX}%`))
  if (existing > 0) {
    log(`rimozione ${existing} voti seed preesistenti (idempotenza)`)
    const { error } = await e2eDb.from('vote_sessions').delete().like('fingerprint', `${SEED_PREFIX}%`)
    if (error) fail(`Delete seed votes preesistenti: ${error.message}`)
  }

  const now = Date.now()
  const windowMs = 3 * 24 * 60 * 60 * 1000
  let inserted = 0
  while (inserted < votes) {
    const size = Math.min(CHUNK, votes - inserted)
    const chunk = []
    for (let i = 0; i < size; i++) {
      const n = inserted + i
      const [c1, c2, c3] = randomTriple(ids)
      chunk.push({
        fingerprint: `${SEED_PREFIX}${n}`,
        country: 'IT',
        user_agent: 'loadtest-seed',
        company1_id: c1,
        company2_id: c2,
        company3_id: c3,
        created_at: new Date(now - Math.floor(Math.random() * windowMs)).toISOString(),
      })
    }
    const { error } = await e2eDb.from('vote_sessions').insert(chunk)
    if (error) fail(`Insert seed votes (${inserted}-${inserted + size}): ${error.message}`)
    inserted += size
    if (inserted % 20_000 === 0 || inserted === votes) log(`voti seed: ${inserted}/${votes}`)
  }
  return inserted
}

async function readCurrentBatch() {
  const { data } = await e2eDb.from('batch_settings').select('active_batch').eq('id', 'default').maybeSingle()
  return data?.active_batch ?? 'TEST'
}

async function setActiveBatch(batch) {
  const { error } = await e2eDb.from('batch_settings').upsert({ id: 'default', active_batch: batch }, { onConflict: 'id' })
  if (error) fail(`Update active_batch in e2e: ${error.message}`)
}

async function verifyRanking() {
  const t0 = Date.now()
  const { error } = await e2eDb.rpc('get_company_ranking', { limit_count: null })
  if (error) fail(`RPC get_company_ranking: ${error.message}`)
  log(`get_company_ranking: ${Date.now() - t0} ms`)
}

/** Riallinea i contatori se i trigger sono stati disabilitati durante il bulk. */
async function recomputeTotals() {
  const { error } = await e2eDb.rpc('recompute_company_totals')
  if (error) {
    log(`recompute_company_totals non disponibile (${error.message}): i contatori restano quelli del trigger`)
  } else {
    log('company_totals ricalcolati')
  }
}

async function main() {
  log('target: fantacer-e2e (write) | source: production (read-only)')
  const batch = await resolveBatch()
  const ids = await importCompanies(batch)
  const priorState = readState()
  const current = await readCurrentBatch()
  const previousActiveBatch =
    priorState && priorState.batch === batch && priorState.previousActiveBatch
      ? priorState.previousActiveBatch
      : current
  await setActiveBatch(batch)
  log(`active_batch e2e: '${current}' -> '${batch}' (ripristino a '${previousActiveBatch}')`)

  log(
    `ATTENZIONE: ogni insert/delete su vote_sessions aggiorna ranking_tick e company_totals (trigger). ` +
      `Per 100k righe e' lento: opzionale disabilitare i trigger con scripts/loadtest/sql/trigger.sql e poi ricalcolare.`,
  )
  const inserted = await seedVotes(ids)
  await recomputeTotals()
  await verifyRanking()

  writeState({
    runId,
    batch,
    previousActiveBatch,
    seedCount: inserted,
    createdAt: new Date().toISOString(),
  })

  const total = await countRows(e2eDb, 'vote_sessions', (q) => q.like('fingerprint', `${SEED_PREFIX}%`))
  console.log('')
  log(`seed completato: ${inserted} voti, ${total} totali con prefisso ${SEED_PREFIX}`)
  log(`RUN_ID per i test k6: ${runId}`)
  log(`prossimo passo: k6 run -e BASE_URL=<app> -e RUN_ID=${runId} tests/load/scenarios/smoke.js`)
}

main().catch((e) => fail(e?.stack || String(e)))
