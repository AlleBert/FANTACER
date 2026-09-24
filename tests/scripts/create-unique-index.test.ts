/**
 * @jest-environment node
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'dotenv'
import pg, { type Client } from 'pg'

/**
 * C10 / D4 — `scripts/p0-4-create-unique-index.mjs`.
 *
 * Unit (sempre): helper puri `detectIndexState`, `summarizeDuplicates`,
 * `planIndexAction`, SQL builder. Caricati in subprocess node perché ts-jest
 * non importa `.mjs`.
 *
 * Integrazione (solo con `SUPABASE_DB_PASSWORD`, progetto fantacer-e2e):
 *  - duplicati presenti → lo script esce non-zero e NON crea l'indice;
 *  - nessun duplicato → crea un indice valido; secondo run → "already-valid";
 *  - indice INVALID omonimo → lo script lo droppa e ricrea valido.
 *
 * Fixture isolate, rimosse in `afterAll`. L'indice creato resta (target E2E).
 *
 *   set -a; source .env.e2e; set +a
 *   npx jest tests/scripts/create-unique-index.test.ts --maxWorkers=1
 */

const HAS_DB = Boolean(process.env.SUPABASE_DB_PASSWORD)
const describeDb = HAS_DB ? describe : describe.skip

const SCRIPT = 'scripts/p0-4-create-unique-index.mjs'
const INDEX_NAME = 'uq_vote_sessions_event_principal_day'

function fileEnv(): Record<string, string> {
  try {
    return parse(readFileSync('.env.e2e', 'utf8'))
  } catch {
    return {}
  }
}

const env = fileEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD

const E2E_REF = 'ookipybsnjtvdrzqzpsl'
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com'

function buildDbUrl(): string {
  const host = new URL(SUPABASE_URL).hostname
  if (host !== `${E2E_REF}.supabase.co`) {
    throw new Error(`Guard: host ${host} != fantacer-e2e`)
  }
  const ref = host.split('.')[0]
  return `postgresql://postgres.${ref}:${encodeURIComponent(DB_PASSWORD)}@${POOLER_HOST}:5432/postgres`
}

interface PureHelpersSnapshot {
  indexName: string
  duplicatesHasGroupHaving: boolean
  duplicatesMentionsVoteDay: boolean
  duplicatesCountHasHaving: boolean
  indexStateMentionsPgIndex: boolean
  indexStateMentionsIndisvalid: boolean
  createSqlHasConcurrently: boolean
  createSqlHasPredicate: boolean
  createSqlHasUnique: boolean
  missing: unknown
  valid: unknown
  invalid: unknown
  notReady: unknown
  summary: unknown
  planValid: string
  planRecreate: string
  planCreate: string
  planDryRunMissing: string
  planDryRunInvalid: string
}

/**
 * I test in ts-jest non importano `.mjs`: valuto gli helper puri in un
 * subprocess node, senza DB.
 */
function evalPureHelpers(): PureHelpersSnapshot {
  const libUrl = pathToFileURL(join(process.cwd(), 'scripts/p0-4-create-unique-index-lib.mjs')).href
  const code = `
    import {
      INDEX_NAME, createIndexSql, detectIndexState, duplicatesCountQuery,
      duplicatesQuery, indexStateQuery, planIndexAction, summarizeDuplicates,
    } from ${JSON.stringify(libUrl)}
    console.log(JSON.stringify({
      indexName: INDEX_NAME,
      duplicatesHasGroupHaving: duplicatesQuery().includes('having count(*) > 1'),
      duplicatesMentionsVoteDay: duplicatesQuery().includes('vote_day'),
      duplicatesCountHasHaving: duplicatesCountQuery().includes('having count(*) > 1'),
      indexStateMentionsPgIndex: indexStateQuery().includes('pg_index'),
      indexStateMentionsIndisvalid: indexStateQuery().includes('indisvalid'),
      createSqlHasConcurrently: /create unique index concurrently/i.test(createIndexSql()),
      createSqlHasPredicate: createIndexSql().includes('where event_id is not null and principal_id is not null'),
      createSqlHasUnique: /create unique index/i.test(createIndexSql()),
      missing: detectIndexState([]),
      valid: detectIndexState([{ is_valid: true, is_ready: true }]),
      invalid: detectIndexState([{ is_valid: false, is_ready: false }]),
      notReady: detectIndexState([{ is_valid: true, is_ready: false }]),
      summary: summarizeDuplicates(
        [{ event_id: 'e1', principal_id: 'p1', vote_day: '2026-01-01', duplicate_count: '3' }],
        { duplicate_groups: '2', duplicate_rows: '7' },
      ),
      planValid: planIndexAction({ exists: true, valid: true }, {}),
      planRecreate: planIndexAction({ exists: true, valid: false }, {}),
      planCreate: planIndexAction({ exists: false, valid: false }, {}),
      planDryRunMissing: planIndexAction({ exists: false, valid: false }, { dryRun: true }),
      planDryRunInvalid: planIndexAction({ exists: true, valid: false }, { dryRun: true }),
    }))
  `
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
  if (res.status !== 0) throw new Error(`lib eval exit ${res.status}\n${res.stderr}`)
  const lines = res.stdout.trim().split('\n').filter(Boolean)
  return JSON.parse(lines[lines.length - 1]) as PureHelpersSnapshot
}

interface IndexReport {
  index: string
  target: string
  dryRun: boolean
  action: string
  duplicateGroups: number
  duplicateRows: number
  duplicates: unknown[]
  indexBefore: { exists: boolean; valid: boolean; state: string }
  indexAfter: { exists: boolean; valid: boolean; state: string }
  droppedInvalid: boolean
  durationMs: number
  message?: string
}

function runScript(extra: string[] = []): {
  status: number | null
  report: IndexReport | null
  stdout: string
  stderr: string
} {
  const res = spawnSync(process.execPath, [SCRIPT, '--json', ...extra], {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
  const lines = (res.stdout ?? '').trim().split('\n').filter(Boolean)
  let report: IndexReport | null = null
  if (lines.length) {
    try {
      report = JSON.parse(lines[lines.length - 1]) as IndexReport
    } catch {
      report = null
    }
  }
  return { status: res.status, report, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

describe('helper puri (p0-4-create-unique-index-lib)', () => {
  it('costruisce SQL e decide lo stato dell indice', () => {
    const s = evalPureHelpers()

    expect(s.indexName).toBe(INDEX_NAME)
    expect(s.duplicatesHasGroupHaving).toBe(true)
    expect(s.duplicatesMentionsVoteDay).toBe(true)
    expect(s.duplicatesCountHasHaving).toBe(true)
    expect(s.indexStateMentionsPgIndex).toBe(true)
    expect(s.indexStateMentionsIndisvalid).toBe(true)
    expect(s.createSqlHasConcurrently).toBe(true)
    expect(s.createSqlHasUnique).toBe(true)
    expect(s.createSqlHasPredicate).toBe(true)

    expect(s.missing).toEqual({ exists: false, valid: false, state: 'missing' })
    expect(s.valid).toEqual({ exists: true, valid: true, state: 'valid' })
    expect(s.invalid).toEqual({ exists: true, valid: false, state: 'invalid' })
    expect(s.notReady).toEqual({ exists: true, valid: false, state: 'invalid' })

    expect(s.summary).toEqual({
      groups: 2,
      rows: 7,
      sample: [
        { event_id: 'e1', principal_id: 'p1', vote_day: '2026-01-01', duplicate_count: 3 },
      ],
    })

    expect(s.planValid).toBe('already-valid')
    expect(s.planRecreate).toBe('recreate')
    expect(s.planCreate).toBe('create')
    expect(s.planDryRunMissing).toBe('dry-run')
    expect(s.planDryRunInvalid).toBe('dry-run')
  })
})

describeDb('p0-4-create-unique-index (integrazione E2E)', () => {
  let db: Client
  let eventId = ''
  let principalId = ''
  let c1 = ''
  let c2 = ''
  let c3 = ''

  const RUN = `cui${Date.now().toString(36)}`
  const BATCH = `CUI_${RUN}`
  const FP_DUP_A = `${RUN}-dup-a`
  const FP_DUP_B = `${RUN}-dup-b`
  const FP_ONE = `${RUN}-one`
  const FIXTURE_FPS = [FP_DUP_A, FP_DUP_B, FP_ONE]

  async function insertVote(fingerprint: string): Promise<void> {
    await db.query(
      `insert into public.vote_sessions
         (fingerprint, company1_id, company2_id, company3_id, event_id, principal_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [fingerprint, c1, c2, c3, eventId, principalId],
    )
  }

  async function deleteVotes(): Promise<void> {
    await db.query('delete from public.vote_sessions where fingerprint = any($1::text[])', [
      FIXTURE_FPS,
    ])
  }

  async function rawIndexState(): Promise<{ is_valid: boolean; is_ready: boolean } | null> {
    const { rows } = await db.query<{ is_valid: boolean; is_ready: boolean }>(
      `select i.indisvalid as is_valid, i.indisready as is_ready
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         join pg_index i on i.indexrelid = c.oid
        where n.nspname = 'public' and c.relname = $1`,
      [INDEX_NAME],
    )
    return rows[0] ?? null
  }

  beforeAll(async () => {
    if (!SUPABASE_URL || !DB_PASSWORD) {
      throw new Error('Credenziali E2E mancanti (.env.e2e o env).')
    }
    db = new pg.Client({ connectionString: buildDbUrl() })
    await db.connect()

    // Controllo esplicito dello stato: parto senza indice target.
    await db.query(`drop index if exists public.${INDEX_NAME}`)

    const ev = await db.query<{ id: string }>(
      `insert into public.events (slug, name, batch, status)
       values ($1, $2, $3, 'draft') returning id`,
      [`cui-${RUN}`, `CUI ${RUN}`, BATCH],
    )
    eventId = ev.rows[0].id

    const cs = await db.query<{ id: string }>(
      `insert into public.companies (name, batch)
       values ($1, $2), ($3, $2), ($4, $2) returning id`,
      [`${RUN} A`, BATCH, `${RUN} B`, `${RUN} C`],
    )
    c1 = cs.rows[0].id
    c2 = cs.rows[1].id
    c3 = cs.rows[2].id

    const p = await db.query<{ id: string }>(
      `insert into public.event_principals (event_id, legacy_fingerprint)
       values ($1, $2) returning id`,
      [eventId, `${RUN}-legacy`],
    )
    principalId = p.rows[0].id
  })

  afterAll(async () => {
    if (!db) return
    try {
      await deleteVotes()
      await db.query('delete from public.event_principals where event_id = $1', [eventId])
      await db.query('delete from public.companies where batch = $1', [BATCH])
      await db.query('delete from public.events where id = $1', [eventId])
    } finally {
      await db.end()
    }
  })

  it('duplicati presenti → abort non-zero, nessun indice creato', async () => {
    await deleteVotes()
    await insertVote(FP_DUP_A)
    await insertVote(FP_DUP_B)

    const { status, report } = runScript()

    expect(status).not.toBe(0)
    expect(report).not.toBeNull()
    expect(report!.action).toBe('aborted-duplicates')
    expect(report!.duplicateGroups).toBeGreaterThanOrEqual(1)
    expect(report!.duplicateRows).toBeGreaterThanOrEqual(2)
    expect(report!.indexAfter.valid).toBe(false)
    expect(await rawIndexState()).toBeNull()
  })

  it('senza duplicati crea indice valido; il secondo run è already-valid', async () => {
    await deleteVotes()
    await insertVote(FP_ONE)

    const first = runScript()
    expect(first.status).toBe(0)
    expect(first.report!.action).toBe('created')
    expect(first.report!.indexAfter).toEqual({ exists: true, valid: true, state: 'valid' })

    const raw = await rawIndexState()
    expect(raw?.is_valid).toBe(true)
    expect(raw?.is_ready).toBe(true)

    const second = runScript()
    expect(second.status).toBe(0)
    expect(second.report!.action).toBe('already-valid')
    expect(second.report!.indexAfter.valid).toBe(true)
  })

  it('indice INVALID omonimo → lo droppa e ricrea valido', async () => {
    // Stato di partenza: niente indice, duplicati presenti per forzare un
    // build CONCURRENTLY fallito che lascia un indice INVALID.
    await db.query(`drop index if exists public.${INDEX_NAME}`)
    await deleteVotes()
    await insertVote(FP_DUP_A)
    await insertVote(FP_DUP_B)

    let failed = false
    try {
      await db.query(
        `create unique index concurrently ${INDEX_NAME}
           on public.vote_sessions (event_id, principal_id, vote_day)
           where event_id is not null and principal_id is not null`,
      )
    } catch {
      failed = true
    }
    expect(failed).toBe(true)

    const invalid = await rawIndexState()
    expect(invalid).not.toBeNull()
    expect(invalid!.is_valid).toBe(false)

    // Bonifica dei duplicati, poi lo script deve droppare l'INVALID e ricreare.
    await deleteVotes()

    const { status, report } = runScript()
    expect(status).toBe(0)
    expect(report!.action).toBe('recreated')
    expect(report!.droppedInvalid).toBe(true)
    expect(report!.indexAfter).toEqual({ exists: true, valid: true, state: 'valid' })

    const raw = await rawIndexState()
    expect(raw?.is_valid).toBe(true)
  })

  it('--dry-run non scrive e riporta lo stato', async () => {
    await db.query(`drop index if exists public.${INDEX_NAME}`)

    const { status, report } = runScript(['--dry-run'])
    expect(status).toBe(0)
    expect(report!.dryRun).toBe(true)
    expect(report!.action).toBe('dry-run')
    expect(report!.indexAfter.valid).toBe(false)
    expect(await rawIndexState()).toBeNull()
  })
})
