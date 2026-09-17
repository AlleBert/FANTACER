#!/usr/bin/env node
/**
 * Sampler DB per il load test: ogni `--interval` ms legge statistiche di
 * catalogo (sola lettura) e le appende in `--out/db.ndjson`.
 *
 * Scrive anche gli snapshot `pg_stat_statements` all'avvio (pgss-before.json)
 * e allo stop su SIGTERM/SIGINT (pgss-after.json), per calcolare i delta della
 * finestra di test.
 *
 * Usage (invocato dal wrapper run-scenario.mjs):
 *   node scripts/loadtest/db-monitor.mjs --out=<dir> [--interval=10000]
 */
import pg from 'pg'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fail, loadE2eDbUrl } from './lib.mjs'

const { Client } = pg

const args = {}
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([a-z-]+)=?(.*)$/)
  if (m) args[m[1]] = m[2] === '' ? true : m[2]
}
if (!args.out) fail('db-monitor: --out=<dir> richiesto')
const outDir = String(args.out)
const intervalMs = Number(args.interval || 10000)
mkdirSync(outDir, { recursive: true })
const ndjsonPath = `${outDir}/db.ndjson`

const SAMPLE_SQL = `
select
  (select count(*) from pg_stat_activity)::int as conn_total,
  (select count(*) from pg_stat_activity where state = 'active')::int as conn_active,
  (select count(*) from pg_stat_activity where state = 'idle')::int as conn_idle,
  (select count(*) from pg_stat_activity where state = 'idle in transaction')::int as conn_idle_tx,
  (select count(*) from pg_locks where not granted)::int as blocked_locks,
  (select count(*) from pg_stat_activity
     where state = 'active' and now() - query_start > interval '2 seconds'
       and pid <> pg_backend_pid())::int as long_active,
  (select xact_commit from pg_stat_database where datname = current_database())::bigint as xact_commit,
  (select xact_rollback from pg_stat_database where datname = current_database())::bigint as xact_rollback,
  (select blks_read from pg_stat_database where datname = current_database())::bigint as blks_read,
  (select blks_hit from pg_stat_database where datname = current_database())::bigint as blks_hit,
  (select temp_bytes from pg_stat_database where datname = current_database())::bigint as temp_bytes,
  (select deadlocks from pg_stat_database where datname = current_database())::bigint as deadlocks,
  (pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0'))::bigint as wal_bytes
`

const TABLES_SQL = `
select relname, n_tup_ins::bigint as ins, n_tup_del::bigint as del,
       seq_scan::bigint as seq, idx_scan::bigint as idx
from pg_stat_user_tables
where relname in ('vote_sessions', 'device_sessions', 'companies', 'audit_logs')
`

const PGSS_SQL = `
select queryid::text, regexp_replace(query, '\\s+', ' ', 'g') as query,
       calls::bigint as calls, total_exec_time
from pg_stat_statements
order by total_exec_time desc
limit 100
`

const client = new Client({
  connectionString: loadE2eDbUrl(),
  ssl: { rejectUnauthorized: false },
})

let timer = null
let stopping = false

function log(...a) {
  console.log('[db-monitor]', ...a)
}

async function pgssSnapshot(path) {
  const { rows } = await client.query(PGSS_SQL)
  writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2))
}

async function sample() {
  const at = new Date().toISOString()
  const s = (await client.query(SAMPLE_SQL)).rows[0]
  const tables = (await client.query(TABLES_SQL)).rows
  appendFileSync(ndjsonPath, JSON.stringify({ at, ...s, tables }) + '\n')
}

async function finalize(signal) {
  if (stopping) return
  stopping = true
  if (timer) clearInterval(timer)
  try {
    await sample()
    await pgssSnapshot(`${outDir}/pgss-after.json`)
    log(`stop (${signal}) -> pgss-after.json scritto`)
  } catch (e) {
    log('errore in finalize:', e.message)
  } finally {
    try {
      await client.end()
    } catch {}
    process.exit(0)
  }
}

async function main() {
  await client.connect()
  await pgssSnapshot(`${outDir}/pgss-before.json`)
  await sample()
  log(`attivo: out=${outDir} interval=${intervalMs}ms`)
  timer = setInterval(() => {
    sample().catch((e) => log('sample error:', e.message))
  }, intervalMs)
}

process.on('SIGTERM', () => finalize('SIGTERM'))
process.on('SIGINT', () => finalize('SIGINT'))

main().catch((e) => fail(`db-monitor: ${e.message}`))
