#!/usr/bin/env node
/**
 * P0-4c / F1 — Backfill `event_principals` **per evento/batch**.
 *
 * Mappa i `fingerprint` distinti dei voti dell'evento (intero storico, non solo
 * oggi). Un voto "appartiene" al batch dell'evento se **tutte e tre** le
 * aziende (`company1_id/company2_id/company3_id`) sono nel batch: le righe
 * miste sono validate, skippate e riportate (nessuna scrittura).
 *
 * - keyset su `fingerprint`, batch configurabile, resumibile, idempotente
 *   (`WHERE NOT EXISTS` + `on conflict do nothing`);
 * - `statement_timeout` FINITO (30s) + `lock_timeout` (5s);
 * - **nessuna** DELETE/TRUNCATE, nessun trigger/contatore toccato;
 * - evento da `--event-id`, altrimenti `batch_settings.active_event_id`,
 *   altrimenti `events.batch = active_batch AND status='active'`.
 *
 * Sicurezza: usa la connessione E2E (`loadE2eDbUrl`, guard host). Per produzione
 * servono `BACKFILL_DB_URL=<url>` **e** `--allow-prod` esplicito (snapshot prima).
 * `loadE2eDbUrl` rifiuta comunque una URL di production: usare `BACKFILL_DB_URL`.
 *
 * Uso:
 *   node scripts/p0-4-backfill.mjs [--event-id UUID] [--batch-size 50000]
 *                                  [--checkpoint FILE] [--resume] [--json]
 *                                  [--allow-prod]
 *
 * `--json` stampa solo il report JSON su stdout (log su stderr), pensato per i
 * test/integrazione.
 */

import pg from 'pg'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { E2E_HOST, PROD_HOST, loadE2eDbUrl } from './loadtest/lib.mjs'

const STATEMENT_TIMEOUT = '30s'
const LOCK_TIMEOUT = '5s'
const DEFAULT_CHECKPOINT_DIR = '.backfill'

const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : def
}
const hasFlag = (name) => args.includes(name)

const allowProd = hasFlag('--allow-prod')
const asJson = hasFlag('--json')
const resume = hasFlag('--resume')
const eventIdArg = getArg('--event-id', null)
const batchSize = Number(getArg('--batch-size', '50000'))

if (!Number.isInteger(batchSize) || batchSize <= 0) {
  console.error('--batch-size deve essere un intero positivo.')
  process.exit(1)
}

const log = (...parts) => {
  const line = parts.join(' ')
  if (asJson) console.error(line)
  else console.log(line)
}

/* ------------------------------------------------------------------ guard --- */

/** Ref del progetto Supabase, da username `postgres.<ref>` o host `<ref>.supabase.co`. */
function dbRef(url) {
  const parsed = new URL(url)
  const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/)
  if (m) return m[1]
  if (parsed.hostname.endsWith('.supabase.co')) return parsed.hostname.split('.')[0]
  return null
}

const PROD_REF = PROD_HOST.split('.')[0]
const E2E_REF = E2E_HOST.split('.')[0]

const url = process.env.BACKFILL_DB_URL || loadE2eDbUrl()
let ref
try {
  ref = dbRef(url)
} catch {
  console.error('URL DB non valida.')
  process.exit(1)
}
if (ref === PROD_REF && !allowProd) {
  console.error('Rifiutato: connessione a production senza --allow-prod.')
  process.exit(1)
}
if (ref !== PROD_REF && ref !== E2E_REF && !allowProd) {
  console.error(`Rifiutato: host/ref inatteso (${ref ?? 'sconosciuto'}); atteso ${E2E_REF}.`)
  process.exit(1)
}

/* --------------------------------------------------------------- database --- */

const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query(`set statement_timeout = '${STATEMENT_TIMEOUT}'`)
await client.query(`set lock_timeout = '${LOCK_TIMEOUT}'`)

/** Evento attivo: `active_event_id`, altrimenti `events.batch = active_batch AND status='active'`. */
async function resolveEvent() {
  if (eventIdArg) {
    const r = await client.query('select id, batch from public.events where id = $1', [eventIdArg])
    if (!r.rows[0]) throw new Error(`Evento ${eventIdArg} non trovato.`)
    return r.rows[0]
  }

  const bs = await client.query(
    "select active_batch, active_event_id from public.batch_settings where id = 'default'",
  )
  const row = bs.rows[0]

  if (row?.active_event_id) {
    const r = await client.query('select id, batch from public.events where id = $1', [
      row.active_event_id,
    ])
    if (r.rows[0]) return r.rows[0]
  }

  if (row?.active_batch) {
    const r = await client.query(
      "select id, batch from public.events where batch = $1 and status = 'active' order by created_at desc limit 1",
      [row.active_batch],
    )
    if (r.rows[0]) return r.rows[0]
  }

  throw new Error('Nessun evento attivo (batch_settings.active_event_id o events.status=active).')
}

/* ------------------------------------------------------------- checkpoint --- */

function checkpointFile(eventId) {
  return getArg('--checkpoint', `${DEFAULT_CHECKPOINT_DIR}/${eventId}.json`)
}

function readCheckpoint(path, eventId) {
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    if (data?.eventId !== eventId || typeof data.lastFingerprint !== 'string') return null
    return data.lastFingerprint
  } catch {
    return null
  }
}

function writeCheckpoint(path, eventId, lastFingerprint) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ eventId, lastFingerprint, updatedAt: new Date().toISOString() }))
}

/* ------------------------------------------------------------------ query --- */

/** Pagina keyset: fingerprint distinti dei voti validi del batch, non ancora mappati. */
async function fetchPage(eventId, batch, last, limit) {
  const { rows } = await client.query(
    `select distinct vs.fingerprint as fp
       from public.vote_sessions vs
       join public.companies c1 on c1.id = vs.company1_id and c1.batch = $2
       join public.companies c2 on c2.id = vs.company2_id and c2.batch = $2
       join public.companies c3 on c3.id = vs.company3_id and c3.batch = $2
      where vs.fingerprint > $1
        and not exists (
          select 1 from public.event_principals ep
           where ep.event_id = $3 and ep.legacy_fingerprint = vs.fingerprint
        )
      order by vs.fingerprint asc
      limit $4`,
    [last, batch, eventId, limit],
  )
  return rows.map((r) => r.fp)
}

async function insertPrincipals(eventId, fingerprints) {
  if (fingerprints.length === 0) return 0
  const res = await client.query(
    `insert into public.event_principals (event_id, legacy_fingerprint)
     select $1, unnest($2::text[])
     on conflict (event_id, legacy_fingerprint) do nothing`,
    [eventId, fingerprints],
  )
  return res.rowCount ?? 0
}

/** Copertura dei fingerprint validi del batch: totale e non mappati. */
async function coverage(eventId, batch) {
  const { rows } = await client.query(
    `with valid as (
       select distinct vs.fingerprint as fingerprint
         from public.vote_sessions vs
         join public.companies c1 on c1.id = vs.company1_id and c1.batch = $1
         join public.companies c2 on c2.id = vs.company2_id and c2.batch = $1
         join public.companies c3 on c3.id = vs.company3_id and c3.batch = $1
     )
     select count(*)::bigint as processed,
            count(*) filter (where ep.id is null)::bigint as non_mapped
       from valid v
       left join public.event_principals ep
         on ep.event_id = $2 and ep.legacy_fingerprint = v.fingerprint`,
    [batch, eventId],
  )
  return { processed: Number(rows[0].processed), nonMapped: Number(rows[0].non_mapped) }
}

/** Righe miste che toccano il batch ma non vi appartengono interamente (distinct). */
async function skippedInvalid(batch) {
  const { rows } = await client.query(
    `select count(distinct vs.fingerprint)::bigint as n
       from public.vote_sessions vs
      where exists (
              select 1 from public.companies c
               where c.id in (vs.company1_id, vs.company2_id, vs.company3_id)
                 and c.batch = $1
            )
        and not (
              exists (select 1 from public.companies c where c.id = vs.company1_id and c.batch = $1)
          and exists (select 1 from public.companies c where c.id = vs.company2_id and c.batch = $1)
          and exists (select 1 from public.companies c where c.id = vs.company3_id and c.batch = $1)
        )`,
    [batch],
  )
  return Number(rows[0].n)
}

/** Divergenza dedup legacy (`fingerprint`, `vote_day`) vs principal (`principal_id`, `vote_day`). */
async function divergence(eventId, batch) {
  const { rows } = await client.query(
    `with valid as (
       select vs.fingerprint, vs.vote_day
         from public.vote_sessions vs
         join public.companies c1 on c1.id = vs.company1_id and c1.batch = $1
         join public.companies c2 on c2.id = vs.company2_id and c2.batch = $1
         join public.companies c3 on c3.id = vs.company3_id and c3.batch = $1
     ),
     legacy as (
       select count(*)::bigint as n from (select distinct fingerprint, vote_day from valid) t
     ),
     principal as (
       select count(*)::bigint as n
         from (
           select distinct ep.id, v.vote_day
             from valid v
             join public.event_principals ep
               on ep.event_id = $2 and ep.legacy_fingerprint = v.fingerprint
         ) t
     )
     select (select n from legacy) as legacy, (select n from principal) as principal`,
    [batch, eventId],
  )
  return { legacy: Number(rows[0].legacy), principal: Number(rows[0].principal) }
}

/* ------------------------------------------------------------------- main --- */

const startedAt = Date.now()
const event = await resolveEvent()
const { id: eventId, batch } = event
log(`backfill evento=${eventId} batch=${batch} batch-size=${batchSize}`)

const checkpointPath = checkpointFile(eventId)
let last = ''
if (resume) {
  const saved = readCheckpoint(checkpointPath, eventId)
  if (saved) {
    last = saved
    log(`resume da checkpoint ${checkpointPath}: fingerprint > '${last}'`)
  } else {
    log(`checkpoint ${checkpointPath} assente/non valido: parto da zero`)
  }
}
const resumeFrom = last

let inserted = 0
let pages = 0
for (;;) {
  const page = await fetchPage(eventId, batch, last, batchSize)
  if (page.length === 0) break

  const count = await insertPrincipals(eventId, page)
  inserted += count
  pages += 1
  last = page[page.length - 1]
  writeCheckpoint(checkpointPath, eventId, last)
  log(`backfill: pagina ${pages} +${page.length} fingerprint (principals inseriti: ${count})`)
}

const cov = await coverage(eventId, batch)
const skipped = await skippedInvalid(batch)
const div = await divergence(eventId, batch)
const divergences = div.legacy - div.principal

// Completato: il checkpoint non serve più (il prossimo run riparte da zero).
if (existsSync(checkpointPath)) rmSync(checkpointPath, { force: true })

const report = {
  eventId,
  batch,
  processed: cov.processed,
  inserted,
  nonMapped: cov.nonMapped,
  skippedInvalid: skipped,
  divergences,
  legacyVotes: div.legacy,
  principalVotes: div.principal,
  coveragePct: cov.processed === 0 ? 100 : Math.round(((cov.processed - cov.nonMapped) / cov.processed) * 10000) / 100,
  pages,
  durationMs: Date.now() - startedAt,
  resumeFrom: resumeFrom || null,
}

if (asJson) console.log(JSON.stringify(report))
else console.log('backfill completato:', report)

await client.end()

if (report.nonMapped !== 0 || report.divergences !== 0) {
  console.error(
    `ATTENZIONE: non_mappati=${report.nonMapped} divergenze=${report.divergences} (atteso 0).`,
  )
  process.exitCode = 1
}
