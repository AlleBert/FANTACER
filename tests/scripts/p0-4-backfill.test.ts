/**
 * @jest-environment node
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Integrazione F1 — `scripts/p0-4-backfill.mjs` per evento/batch.
 *
 * Verifica: scoping al batch dell'evento, idempotenza (secondo run → 0
 * inserimenti), copertura 100% dei fingerprint validi, 0 divergenze dedup
 * legacy vs principal, validazione delle 3 aziende (riga mista skippata, nessun
 * principal scritto).
 *
 * Richiede il progetto **fantacer-e2e**. Di default è SALTATO perché jest non
 * carica `.env.e2e`. Per eseguirlo:
 *
 *   set -a; source .env.e2e; set +a
 *   npx jest tests/scripts/p0-4-backfill.test.ts --maxWorkers=1
 *
 * Il test crea un evento dedicato con batch univoco, aziende (3 nel batch + 1
 * in un batch estraneo), due voti validi e uno misto, esegue lo script due
 * volte via CLI e pulisce solo le righe del fixture.
 */

const HAS_DB = Boolean(process.env.SUPABASE_DB_PASSWORD)
const describeDb = HAS_DB ? describe : describe.skip

function fileEnv(): Record<string, string> {
  if (!existsSync('.env.e2e')) return {}
  return parse(readFileSync('.env.e2e', 'utf8'))
}

const env = fileEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

const RUN = `bfit${Date.now().toString(36)}`
const BATCH = `BF_TEST_${RUN}`
const OTHER_BATCH = `BF_OTHER_${RUN}`
const VALID_FP = [`${RUN}-valid-1`, `${RUN}-valid-2`]
const INVALID_FP = `${RUN}-invalid-1`

interface BackfillReport {
  eventId: string
  batch: string
  processed: number
  inserted: number
  nonMapped: number
  skippedInvalid: number
  divergences: number
  coveragePct: number
  coverageScope: string
  legacyVotes: number
  principalVotes: number
}

interface RetryHelperSnapshot {
  min: number
  half: number
  halfOfHalf: number
  atMin: number
  belowMin: number
  timeout57014: boolean
  timeoutMessage: boolean
  timeoutOther: boolean
  timeoutNull: boolean
}

/**
 * I test in ts-jest non importano `.mjs`: valuto gli helper puri in un
 * subprocess node, senza DB.
 */
function evalRetryHelpers(): RetryHelperSnapshot {
  const libUrl = pathToFileURL(join(process.cwd(), 'scripts/p0-4-backfill-lib.mjs')).href
  const code = `
    import { MIN_BATCH_SIZE, isStatementTimeout, nextRetryBatchSize } from ${JSON.stringify(libUrl)}
    console.log(JSON.stringify({
      min: MIN_BATCH_SIZE,
      half: nextRetryBatchSize(50000),
      halfOfHalf: nextRetryBatchSize(1000),
      atMin: nextRetryBatchSize(MIN_BATCH_SIZE),
      belowMin: nextRetryBatchSize(400),
      timeout57014: isStatementTimeout({ code: '57014' }),
      timeoutMessage: isStatementTimeout({ message: 'canceling statement due to statement timeout' }),
      timeoutOther: isStatementTimeout({ code: '23505' }),
      timeoutNull: isStatementTimeout(null),
    }))
  `
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
  if (res.status !== 0) throw new Error(`lib eval exit ${res.status}\n${res.stderr}`)
  const lines = res.stdout.trim().split('\n').filter(Boolean)
  return JSON.parse(lines[lines.length - 1]) as RetryHelperSnapshot
}

function runBackfill(eventId: string): BackfillReport {
  const res = spawnSync(
    process.execPath,
    ['scripts/p0-4-backfill.mjs', '--event-id', eventId, '--batch-size', '1', '--json'],
    { encoding: 'utf8', cwd: process.cwd() },
  )
  if (res.status !== 0) {
    throw new Error(`backfill exit ${res.status}\nSTDERR:\n${res.stderr}\nSTDOUT:\n${res.stdout}`)
  }
  const lines = res.stdout.trim().split('\n').filter(Boolean)
  return JSON.parse(lines[lines.length - 1]) as BackfillReport
}

describe('retry helper (p0-4-backfill-lib)', () => {
  it('dimezza il batch senza scendere sotto il minimo e riconosce lo statement timeout', () => {
    const s = evalRetryHelpers()

    expect(s.min).toBe(500)
    expect(s.half).toBe(25000)
    expect(s.halfOfHalf).toBe(500)
    expect(s.atMin).toBe(500)
    expect(s.belowMin).toBe(500)
    expect(s.timeout57014).toBe(true)
    expect(s.timeoutMessage).toBe(true)
    expect(s.timeoutOther).toBe(false)
    expect(s.timeoutNull).toBe(false)
  })
})

describeDb('p0-4-backfill per evento/batch', () => {
  let db: SupabaseClient
  let eventId = ''
  const fixtureFingerprints = [...VALID_FP, INVALID_FP]

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error('Credenziali E2E mancanti (.env.e2e o env).')
    }
    db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: event, error: evErr } = await db
      .from('events')
      .insert({ slug: `bf-${RUN}`, name: `Backfill ${RUN}`, batch: BATCH, status: 'draft' })
      .select('id')
      .single()
    if (evErr || !event) throw new Error(`event seed: ${evErr?.message}`)
    eventId = event.id

    const { data: companies, error: coErr } = await db
      .from('companies')
      .insert([
        { name: `${RUN} A`, batch: BATCH },
        { name: `${RUN} B`, batch: BATCH },
        { name: `${RUN} C`, batch: BATCH },
        { name: `${RUN} D`, batch: OTHER_BATCH },
      ])
      .select('id, batch')
    if (coErr || !companies) throw new Error(`company seed: ${coErr?.message}`)

    const inBatch = companies.filter((c) => c.batch === BATCH)
    const outBatch = companies.find((c) => c.batch === OTHER_BATCH)
    if (inBatch.length !== 3 || !outBatch) throw new Error('fixture aziende incompleta')

    const now = new Date().toISOString()
    const { error: vErr } = await db.from('vote_sessions').insert([
      {
        fingerprint: VALID_FP[0],
        company1_id: inBatch[0].id,
        company2_id: inBatch[1].id,
        company3_id: inBatch[2].id,
        created_at: now,
      },
      {
        fingerprint: VALID_FP[1],
        company1_id: inBatch[2].id,
        company2_id: inBatch[0].id,
        company3_id: inBatch[1].id,
        created_at: now,
      },
      {
        // Riga mista: due aziende del batch, una fuori → validazione la skippa.
        fingerprint: INVALID_FP,
        company1_id: inBatch[0].id,
        company2_id: outBatch.id,
        company3_id: inBatch[1].id,
        created_at: now,
      },
    ])
    if (vErr) throw new Error(`vote seed: ${vErr.message}`)
  })

  afterAll(async () => {
    if (!db || !eventId) return
    await db.from('event_principals').delete().eq('event_id', eventId)
    await db.from('vote_sessions').delete().in('fingerprint', fixtureFingerprints)
    await db.from('companies').delete().in('batch', [BATCH, OTHER_BATCH])
    await db.from('events').delete().eq('id', eventId)
  })

  it('primo run: mappa i voti del batch, salta la riga mista, 0 divergenze', async () => {
    const report = runBackfill(eventId)

    expect(report.eventId).toBe(eventId)
    expect(report.batch).toBe(BATCH)
    expect(report.processed).toBe(2)
    expect(report.inserted).toBe(2)
    expect(report.nonMapped).toBe(0)
    expect(report.skippedInvalid).toBe(1)
    expect(report.divergences).toBe(0)
    expect(report.coveragePct).toBe(100)
    expect(report.coverageScope).toBe('event_batch')

    const { data: principals } = await db
      .from('event_principals')
      .select('legacy_fingerprint')
      .eq('event_id', eventId)
    const fps = (principals ?? []).map((p) => p.legacy_fingerprint).sort()
    expect(fps).toEqual([...VALID_FP].sort())
    expect(fps).not.toContain(INVALID_FP)
  })

  it('secondo run: idempotente, 0 inserimenti, stesse metriche', async () => {
    const report = runBackfill(eventId)

    expect(report.inserted).toBe(0)
    expect(report.processed).toBe(2)
    expect(report.nonMapped).toBe(0)
    expect(report.divergences).toBe(0)
    expect(report.coveragePct).toBe(100)
  })
})
