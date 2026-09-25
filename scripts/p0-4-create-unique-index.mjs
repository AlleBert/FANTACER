#!/usr/bin/env node
/**
 * C10 / D4 — Indice unico `uq_vote_sessions_event_principal_day` via
 * `CREATE UNIQUE INDEX CONCURRENTLY`, con gestione degli indici `INVALID`.
 *
 * PERCHE' UNO SCRIPT E NON UNA MIGRATION:
 * `CREATE INDEX CONCURRENTLY` non può girare dentro una transazione, e il
 * runner di `supabase db push` avvolge ogni migration in una transazione.
 * Quindi questo indice è creato **solo** da questo script, **mai** da `db push`.
 *
 * Procedura (idempotente, nessuna DELETE automatica):
 *   1. pre-check duplicati `(event_id, principal_id, vote_day)`: se >0 ABORT con
 *      report (nessuna cancellazione; eseguire prima la quarantena — C11);
 *   2. se un indice omonimo esiste ma è `INVALID` (`pg_index.indisvalid=false`),
 *      lo `DROP INDEX CONCURRENTLY` e prosegue;
 *   3. se esiste **valido** → "already valid", exit 0;
 *   4. crea con `CREATE UNIQUE INDEX CONCURRENTLY` (autocommit, fuori
 *      transazione). Su failure rileva l'`INVALID` residuo, lo droppa e esce
 *      non-zero con le istruzioni.
 *
 * Sicurezza host: usa la connessione E2E (`loadE2eDbUrl`, guard host). Per
 * produzione servono `INDEX_DB_URL=<url>` **e** `--allow-prod` esplicito
 * (snapshot prima).
 *
 * Uso:
 *   node scripts/p0-4-create-unique-index.mjs [--dry-run] [--json] [--allow-prod]
 *
 * `--json` stampa solo il report JSON su stdout (log su stderr), per i test.
 */

import pg from 'pg'
import { E2E_HOST, PROD_HOST, loadE2eDbUrl } from './loadtest/lib.mjs'
import {
  INDEX_NAME,
  createIndexSql,
  detectIndexState,
  duplicatesCountQuery,
  duplicatesQuery,
  indexStateQuery,
  planIndexAction,
  summarizeDuplicates,
} from './p0-4-create-unique-index-lib.mjs'

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(name)

const allowProd = hasFlag('--allow-prod')
const dryRun = hasFlag('--dry-run')
const asJson = hasFlag('--json')

const startedAt = Date.now()

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

let url
try {
  url = process.env.INDEX_DB_URL || loadE2eDbUrl()
} catch (error) {
  console.error(`URL DB non ottenibile: ${error.message}`)
  process.exit(1)
}

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
const target = ref === PROD_REF ? 'prod' : 'e2e'

/* ------------------------------------------------------------------- main --- */

function emit(report) {
  if (asJson) {
    console.log(JSON.stringify(report))
  } else {
    console.log(`indice: ${report.index} (target ${report.target})`)
    console.log(`azione: ${report.action}`)
    console.log(
      `duplicati: gruppi=${report.duplicateGroups} righe=${report.duplicateRows}`,
    )
    console.log(`indice prima: ${report.indexBefore.state}`)
    console.log(`indice dopo: ${report.indexAfter.state}`)
    if (report.message) console.log(`nota: ${report.message}`)
  }
}

async function run() {
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  const report = {
    index: INDEX_NAME,
    target,
    dryRun,
    action: null,
    duplicateGroups: 0,
    duplicateRows: 0,
    duplicates: [],
    indexBefore: { exists: false, valid: false, state: 'missing' },
    indexAfter: { exists: false, valid: false, state: 'missing' },
    droppedInvalid: false,
    message: null,
  }

  try {
    // Il build dell'indice può durare: nessun limite di durata sullo statement.
    // (La creazione è CONCURRENTLY: non blocca i writer.)
    await client.query('set statement_timeout = 0')

    // 1) Pre-check duplicati (nessuna DELETE).
    const countRes = await client.query(duplicatesCountQuery())
    const sampleRes = await client.query(duplicatesQuery(100))
    const duplicates = summarizeDuplicates(sampleRes.rows, countRes.rows[0] ?? {})
    report.duplicateGroups = duplicates.groups
    report.duplicateRows = duplicates.rows
    report.duplicates = duplicates.sample

    // 2) Stato dell'indice.
    const before = detectIndexState((await client.query(indexStateQuery(), [INDEX_NAME])).rows)
    report.indexBefore = before
    report.indexAfter = before

    if (duplicates.groups > 0) {
      report.action = 'aborted-duplicates'
      report.message =
        'Duplicati presenti: eseguire la quarantena (C11) prima di creare l\'indice. Nessuna DELETE eseguita.'
      return { report, exitCode: 1 }
    }

    const planned = planIndexAction(before, { dryRun })

    if (planned === 'already-valid') {
      report.action = 'already-valid'
      return { report, exitCode: 0 }
    }

    if (planned === 'dry-run') {
      report.action = 'dry-run'
      return { report, exitCode: 0 }
    }

    // 3) INVALID omonimo: droppa (CONCURRENTLY) e ricrea.
    let droppedInvalid = false
    if (planned === 'recreate') {
      log(`indice INVALID rilevato: drop index concurrently ${INDEX_NAME}`)
      await client.query(`drop index concurrently if exists public.${INDEX_NAME}`)
      droppedInvalid = true
    }

    // 4) Build fuori transazione (autocommit): create ... concurrently.
    try {
      await client.query(createIndexSql())
    } catch (error) {
      const afterFail = detectIndexState(
        (await client.query(indexStateQuery(), [INDEX_NAME])).rows,
      )
      let cleaned = false
      if (afterFail.exists && !afterFail.valid) {
        try {
          await client.query(`drop index concurrently if exists public.${INDEX_NAME}`)
          cleaned = true
        } catch (dropError) {
          log(`WARN: drop dell'INVALID fallito: ${dropError.message}`)
        }
      }
      const residual = cleaned
        ? { exists: false, valid: false, state: 'missing' }
        : detectIndexState((await client.query(indexStateQuery(), [INDEX_NAME])).rows)
      report.action = 'failed'
      report.droppedInvalid = droppedInvalid
      report.indexAfter = residual
      report.message = `CREATE UNIQUE INDEX CONCURRENTLY fallito: ${error.message}. Indice INVALID ${
        cleaned ? 'rimosso' : 'NON rimosso'
      }: bonifica (C11) e riprova.`
      return { report, exitCode: 1 }
    }

    const after = detectIndexState((await client.query(indexStateQuery(), [INDEX_NAME])).rows)
    report.droppedInvalid = droppedInvalid
    report.indexAfter = after

    if (!after.valid) {
      report.action = 'failed'
      report.message = 'Indice creato ma non risulta valido/ready.'
      return { report, exitCode: 1 }
    }

    report.action = droppedInvalid ? 'recreated' : 'created'
    return { report, exitCode: 0 }
  } finally {
    await client.end()
  }
}

try {
  const { report, exitCode } = await run()
  report.durationMs = Date.now() - startedAt
  emit(report)
  process.exitCode = exitCode
} catch (error) {
  console.error(`Errore: ${error.message}`)
  process.exitCode = 1
}
