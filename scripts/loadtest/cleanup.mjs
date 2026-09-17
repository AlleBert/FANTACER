#!/usr/bin/env node
/**
 * Cleanup del load test su `fantacer-e2e`.
 *
 * Usa una connessione diretta a Postgres (ruolo `postgres`), NON PostgREST:
 * le operazioni massive superano lo `statement_timeout` (8s) del ruolo
 * `authenticator` usato da PostgREST. I due trigger su `vote_sessions` vengono
 * disabilitati durante il bulk (evita 100k x trigger per riga) e riabilitati
 * prima del ricalcolo dei contatori. Tutto in una transazione: in caso di
 * errore il rollback ripristina anche lo stato dei trigger.
 *
 * Ripristina lo stato baseline: rimuove seed/load, le company importate e
 * riporta `batch_settings.active_batch` al valore precedente.
 *
 * Usage:
 *   npm run loadtest:cleanup
 *   npm run loadtest:cleanup -- --keep-companies
 */
import pg from 'pg'
import { clearState, fail, LOAD_PREFIX, loadE2eDbUrl, parseArgs, readState, SEED_PREFIX } from './lib.mjs'

const { Client } = pg

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(`
Usage: npm run loadtest:cleanup [-- --keep-companies]

  --keep-companies  non rimuove le company importate (piu' veloce per run ripetuti)
  --batch=<batch>   batch company da rimuovere (default: da .loadtest/state.json)
  --previous=<b>    active_batch da ripristinare (default: da state, poi TEST)
  --help            questo messaggio
`)
  process.exit(0)
}

const state = readState()
const batch = args.batch ? String(args.batch) : state?.batch
const previousActiveBatch = args.previous ? String(args.previous) : state?.previousActiveBatch ?? 'TEST'

function log(...a) {
  console.log('[cleanup]', ...a)
}

async function main() {
  const client = new Client({ connectionString: loadE2eDbUrl(), ssl: { rejectUnauthorized: false } })
  await client.connect()
  log('target: fantacer-e2e (write, connessione diretta)')

  try {
    await client.query('begin')
    await client.query('set local statement_timeout = 0')

    await client.query('alter table public.vote_sessions disable trigger trg_bump_ranking_tick')
    await client.query('alter table public.vote_sessions disable trigger trg_maintain_company_totals')
    log('trigger disabilitati (bulk)')

    const delPrefix = async (table, column, prefix) => {
      const { rowCount } = await client.query(
        `delete from public.${table} where ${column} like $1`,
        [`${prefix}%`],
      )
      if (rowCount) log(`${table}: rimossi ${rowCount} (${column} LIKE ${prefix}%)`)
      return rowCount
    }

    await delPrefix('vote_sessions', 'fingerprint', SEED_PREFIX)
    await delPrefix('vote_sessions', 'fingerprint', LOAD_PREFIX)
    await delPrefix('audit_logs', 'fingerprint', LOAD_PREFIX)
    await delPrefix('audit_logs', 'fingerprint', SEED_PREFIX)
    await delPrefix('device_sessions', 'fingerprint', LOAD_PREFIX)
    await delPrefix('device_sessions', 'fingerprint', SEED_PREFIX)

    if (!args['keep-companies']) {
      if (!batch) {
        log('batch sconosciuto: salto la rimozione company (usa --batch=<batch> per forzarla)')
      } else {
        const { rowCount } = await client.query('delete from public.companies where batch = $1', [batch])
        if (rowCount) log(`companies batch '${batch}': rimosse ${rowCount}`)
      }
    } else {
      log('company importate mantenute (--keep-companies)')
    }

    await client.query('alter table public.vote_sessions enable trigger trg_bump_ranking_tick')
    await client.query('alter table public.vote_sessions enable trigger trg_maintain_company_totals')
    log('trigger riabilitati')

    await client.query('select public.recompute_company_totals()')
    log('company_totals ricalcolati')

    await client.query('update public.batch_settings set active_batch = $1 where id = $2', [previousActiveBatch, 'default'])
    log(`active_batch ripristinato a '${previousActiveBatch}'`)

    await client.query('commit')

    const seedLeft = (await client.query(
      'select count(*)::int n from public.vote_sessions where fingerprint like $1',
      [`${SEED_PREFIX}%`],
    )).rows[0].n
    const loadLeft = (await client.query(
      'select count(*)::int n from public.vote_sessions where fingerprint like $1',
      [`${LOAD_PREFIX}%`],
    )).rows[0].n
    const triggers = (await client.query(
      'select tgname, tgenabled from pg_trigger where tgrelid = $1::regclass and not tgisinternal order by tgname',
      ['public.vote_sessions'],
    )).rows
    log(`residui: seed=${seedLeft}, load=${loadLeft}`)
    log('trigger: ' + triggers.map((t) => `${t.tgname}=${t.tgenabled}`).join(', '))

    clearState()
    log('cleanup completato')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    fail(`cleanup: ${e.message}`)
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((e) => fail(e?.stack || String(e)))
