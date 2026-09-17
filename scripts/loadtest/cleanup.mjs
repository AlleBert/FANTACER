#!/usr/bin/env node
/**
 * Cleanup del load test su `fantacer-e2e`.
 *
 * Riporta il progetto e2e allo stato baseline:
 * - cancella i voti sintetici (`seed-loadtest-%`) e quelli di load (`loadtest-%`);
 * - cancella `device_sessions`/`audit_logs` prodotti dal load;
 * - rimuove le company importate dal batch (opzionale con --keep-companies);
 * - ripristina `batch_settings.active_batch` al valore precedente al seed.
 *
 * Usage:
 *   npm run loadtest:cleanup
 *   npm run loadtest:cleanup -- --keep-companies
 */
import { adminClient, clearState, countRows, fail, LOAD_PREFIX, loadCreds, parseArgs, readState, SEED_PREFIX } from './lib.mjs'

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(`
Usage: npm run loadtest:cleanup [-- --keep-companies]

  --keep-companies  non rimuove le company importate (piu' veloce per run ripetuti)
  --help            questo messaggio
`)
  process.exit(0)
}

const { e2e } = loadCreds()
const e2eDb = adminClient(e2e)
const state = readState()
const batch = args.batch ? String(args.batch) : state?.batch
const previousActiveBatch = args.previous ? String(args.previous) : state?.previousActiveBatch ?? 'TEST'

function log(...a) {
  console.log('[cleanup]', ...a)
}

async function deleteByPrefix(table, column, prefix) {
  const before = await countRows(e2eDb, table, (q) => q.like(column, `${prefix}%`))
  if (before === 0) return 0
  const { error } = await e2eDb.from(table).delete().like(column, `${prefix}%`)
  if (error) fail(`Delete ${table}.${column} LIKE ${prefix}%: ${error.message}`)
  log(`${table}: rimossi ${before} (${column} LIKE ${prefix}%)`)
  return before
}

async function restoreBatch() {
  const { data } = await e2eDb.from('batch_settings').select('active_batch').eq('id', 'default').maybeSingle()
  const current = data?.active_batch ?? '(nessuno)'
  if (current === previousActiveBatch) {
    log(`active_batch gia' '${current}', nessun ripristino`)
    return
  }
  const { error } = await e2eDb.from('batch_settings').upsert({ id: 'default', active_batch: previousActiveBatch }, { onConflict: 'id' })
  if (error) fail(`Ripristino active_batch: ${error.message}`)
  log(`active_batch ripristinato: '${current}' -> '${previousActiveBatch}'`)
}

async function main() {
  log('target: fantacer-e2e (write)')
  if (!state) log('nessuno stato .loadtest/state.json: uso i prefissi e --previous/--batch espliciti')
  else log(`stato: batch='${state.batch}', runId='${state.runId}', seedCount=${state.seedCount}`)

  await deleteByPrefix('vote_sessions', 'fingerprint', SEED_PREFIX)
  await deleteByPrefix('vote_sessions', 'fingerprint', LOAD_PREFIX)
  await deleteByPrefix('audit_logs', 'fingerprint', LOAD_PREFIX)
  await deleteByPrefix('audit_logs', 'fingerprint', SEED_PREFIX)
  await deleteByPrefix('device_sessions', 'fingerprint', LOAD_PREFIX)
  await deleteByPrefix('device_sessions', 'fingerprint', SEED_PREFIX)

  if (!args['keep-companies']) {
    if (!batch) {
      log('batch sconosciuto: salto la rimozione company (usa --batch=<batch> per forzarla)')
    } else {
      const before = await countRows(e2eDb, 'companies', (q) => q.eq('batch', batch))
      if (before > 0) {
        const { error } = await e2eDb.from('companies').delete().eq('batch', batch)
        if (error) fail(`Delete companies batch '${batch}': ${error.message}`)
        log(`companies batch '${batch}': rimosse ${before}`)
      }
    }
  } else {
    log('company importate mantenute (--keep-companies)')
  }

  await restoreBatch()
  clearState()
  log('cleanup completato')
}

main().catch((e) => fail(e?.stack || String(e)))
