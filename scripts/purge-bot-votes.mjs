#!/usr/bin/env node
/**
 * Purge dei voti fraudolenti su PRODUZIONE.
 *
 * Scope (fisso, deciso con l'organizzazione):
 *   - solo giornata indicata (default 2026-09-22)
 *   - solo schede con FONDOVALLE e MY TOP FONDOVALLE in 1a e 2a posizione
 *     (in qualsiasi ordine) -> pattern frodato "F -> MY TOP"
 *   - NON tocca il voto legittimo ne' i bot con altra azienda in 1a posizione
 *
 * Sicurezza:
 *   - guard fail-fast: rifiuta qualunque host diverso da produzione.
 *   - DRY RUN di default (nessuna scrittura). Serve `--confirm` per eseguire.
 *   - freeze di `voting_enabled` durante l'operazione, sempre ripristinato.
 *   - backup completo delle righe eliminate in `backups/bot-votes-<ts>.json`.
 *
 * Uso:
 *   node scripts/purge-bot-votes.mjs                 # dry run
 *   node scripts/purge-bot-votes.mjs --confirm       # esecuzione definitiva
 *   node scripts/purge-bot-votes.mjs --day=2026-09-22 --confirm
 *
 * SQL equivalente (solo riferimento, se eseguito dall'SQL Editor di Supabase):
 *   -- DRY RUN
 *   select count(*) from vote_sessions
 *   where vote_day = '2026-09-22'
 *     and company1_id in ('c8ffcf79-e07b-482d-a210-a7d340b1d339',
 *                         'a1e3ec5e-738a-42f1-93ca-272e78c6938e')
 *     and company2_id in ('c8ffcf79-e07b-482d-a210-a7d340b1d339',
 *                         'a1e3ec5e-738a-42f1-93ca-272e78c6938e');
 *   -- DEFINITIVA (dentro transazione, previo backup)
 *   delete from vote_sessions
 *   where vote_day = '2026-09-22'
 *     and company1_id in ('c8ffcf79-e07b-482d-a210-a7d340b1d339',
 *                         'a1e3ec5e-738a-42f1-93ca-272e78c6938e')
 *     and company2_id in ('c8ffcf79-e07b-482d-a210-a7d340b1d339',
 *                         'a1e3ec5e-738a-42f1-93ca-272e78c6938e');
 *   select public.recompute_company_totals();
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const PROD_HOST = 'zdfverdwdsigizxktilz.supabase.co'
const FONDOVALLE = 'c8ffcf79-e07b-482d-a210-a7d340b1d339'
const MY_TOP_FONDOVALLE = 'a1e3ec5e-738a-42f1-93ca-272e78c6938e'
const PAIR = [FONDOVALLE, MY_TOP_FONDOVALLE]
const DEFAULT_DAY = '2026-09-22'
const BATCH_SIZE = 100

function fail(message) {
  console.error('\nError:', message)
  process.exit(1)
}

function parseArgs(argv) {
  const out = { confirm: false, day: DEFAULT_DAY }
  for (const raw of argv) {
    const m = raw.match(/^--([a-z-]+)(?:=(.*))?$/)
    if (!m) fail(`Argomento non riconosciuto: ${raw}`)
    if (m[1] === 'confirm') out.confirm = true
    else if (m[1] === 'day') out.day = m[2]
    else fail(`Opzione non riconosciuta: ${raw}`)
  }
  return out
}

function rome(iso) {
  return new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
}

function loadCreds() {
  if (!existsSync('.env')) fail('.env mancante')
  const env = parse(readFileSync('.env', 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL mancante in .env')
  const host = new URL(url).hostname
  if (host !== PROD_HOST) fail(`Guard: host ${host} != production ${PROD_HOST}. Rifiutato.`)
  if (!env.SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY mancante in .env')
  return { url, key: env.SUPABASE_SERVICE_ROLE_KEY }
}

function adminClient({ url, key }) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function candidatesQuery(sb, day) {
  return sb
    .from('vote_sessions')
    .select('id, fingerprint, ip_hash, user_agent, country, company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, created_at, vote_day')
    .eq('vote_day', day)
    .in('company1_id', PAIR)
    .in('company2_id', PAIR)
    .order('created_at')
}

async function fetchCandidates(sb, day) {
  const { data, error } = await candidatesQuery(sb, day)
  if (error) fail(`fetch candidates: ${error.message}`)
  return data ?? []
}

async function fetchDay(sb, day) {
  const { data, error } = await sb
    .from('vote_sessions')
    .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, ip_hash')
    .eq('vote_day', day)
  if (error) fail(`fetch day: ${error.message}`)
  return data ?? []
}

function palletsFor(rows, id) {
  let points = 0
  let votes = 0
  for (const r of rows) {
    if (r.company1_id === id) { points += r.pallet1; votes++ }
    else if (r.company2_id === id) { points += r.pallet2; votes++ }
    else if (r.company3_id === id) { points += r.pallet3; votes++ }
  }
  return { points, votes }
}

async function setVotingEnabled(sb, value) {
  const { error } = await sb
    .from('site_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', 'voting_enabled')
  if (error) throw new Error(`set voting_enabled=${value}: ${error.message}`)
}

async function main() {
  const { confirm, day } = parseArgs(process.argv.slice(2))
  const sb = adminClient(loadCreds())

  const rows = await fetchCandidates(sb, day)
  const dayRows = await fetchDay(sb, day)
  const farms = {}
  for (const r of rows) farms[r.ip_hash] = (farms[r.ip_hash] ?? 0) + 1

  const beforeF = palletsFor(dayRows, FONDOVALLE)
  const beforeM = palletsFor(dayRows, MY_TOP_FONDOVALLE)
  const removedFromDay = rows.reduce((acc, r) => {
    for (const [id, p] of [[r.company1_id, r.pallet1], [r.company2_id, r.pallet2], [r.company3_id, r.pallet3]]) {
      acc[id] = (acc[id] ?? 0) + p
    }
    return acc
  }, {})

  console.log('\n=== PURGE VOTI BOT — ' + (confirm ? 'ESECUZIONE DEFINITIVA' : 'DRY RUN (nessuna scrittura)') + ' ===')
  console.log('Giorno           :', day)
  console.log('Regola           : company1 e company2 = FONDOVALLE / MY TOP FONDOVALLE')
  console.log('Sessioni target  :', rows.length)
  if (rows.length) {
    console.log('Finestra         :', rome(rows[0].created_at), '->', rome(rows[rows.length - 1].created_at))
    console.log('IP coinvolti     :', Object.keys(farms).length)
    for (const [ip, n] of Object.entries(farms).sort((a, b) => b[1] - a[1])) {
      console.log('   ', ip.slice(0, 12) + '…', n)
    }
  }
  console.log('\nImpatto punti (solo giorno ' + day + '):')
  console.log('   FONDOVALLE        :', beforeF.points, '->', beforeF.points - (removedFromDay[FONDOVALLE] ?? 0), `(voti ${beforeF.votes} -> ${beforeF.votes - rows.filter(r => [r.company1_id, r.company2_id, r.company3_id].includes(FONDOVALLE)).length})`)
  console.log('   MY TOP FONDOVALLE :', beforeM.points, '->', beforeM.points - (removedFromDay[MY_TOP_FONDOVALLE] ?? 0), `(voti ${beforeM.votes} -> ${beforeM.votes - rows.filter(r => [r.company1_id, r.company2_id, r.company3_id].includes(MY_TOP_FONDOVALLE)).length})`)

  if (!confirm) {
    console.log('\nDRY RUN concluso. Rilancia con --confirm per eseguire la cancellazione.\n')
    return
  }

  if (rows.length === 0) {
    console.log('\nNessuna sessione da eliminare. Nulla da fare.\n')
    return
  }

  // Backup PRIMA di toccare il DB.
  mkdirSync('backups', { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = `backups/bot-votes-${ts}.json`
  writeFileSync(
    backupFile,
    JSON.stringify(
      { createdAt: new Date().toISOString(), day, rule: 'company1&company2 in (FONDOVALLE,MY_TOP_FONDOVALLE)', count: rows.length, rows },
      null,
      2,
    ),
  )
  console.log('\nBackup scritto   :', backupFile)

  let deleted = 0
  let frozen = false
  try {
    console.log('Freeze voto      : voting_enabled=false')
    await setVotingEnabled(sb, 'false')
    frozen = true

    const ids = rows.map((r) => r.id)
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { data, error } = await sb.from('vote_sessions').delete().in('id', batch).select('id')
      if (error) throw new Error(`delete batch ${i / BATCH_SIZE + 1}: ${error.message}`)
      deleted += data?.length ?? 0
      console.log(`   batch ${String(i / BATCH_SIZE + 1).padStart(2)}: ${data?.length ?? 0} eliminate (totale ${deleted})`)
    }

    const { error: recErr } = await sb.rpc('recompute_company_totals')
    if (recErr) console.warn('WARN recompute_company_totals:', recErr.message)
    else console.log('Contatori        : recompute_company_totals OK')

    const remaining = (await fetchCandidates(sb, day)).length
    console.log('Residue regola   :', remaining)

    const { error: auditErr } = await sb.from('audit_logs').insert({
      event_type: 'bot_votes_purged',
      metadata: {
        day,
        rule: 'company1&company2 in (FONDOVALLE,MY_TOP_FONDOVALLE)',
        deleted,
        requested: rows.length,
        remaining,
        backup_file: backupFile,
        companies: PAIR,
      },
    })
    if (auditErr) console.warn('WARN audit insert:', auditErr.message)
    else console.log('Audit            : bot_votes_purged scritto')
  } finally {
    if (frozen) {
      await setVotingEnabled(sb, 'true')
      console.log('Unfreeze voto    : voting_enabled=true')
    }
  }

  console.log(`\nCompletato: ${deleted} voti eliminati. Backup: ${backupFile}\n`)
}

main().catch((e) => fail(e?.message ?? String(e)))
