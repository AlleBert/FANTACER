/**
 * @jest-environment node
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import pg, { type Client } from 'pg'

/**
 * C13 / FASE G — `scripts/retention.mjs`.
 *
 * Integrazione (progetto fantacer-e2e): fixture isolate su un evento dedicato.
 *  - il dry-run riporta i candidati e **non scrive nulla**;
 *  - `--apply` elimina solo le righe oltre l'orizzonte (sessioni/principal/nonce)
 *    e anonimizza le PII legacy di `vote_sessions`/`audit_logs` senza mai
 *    cancellare i voti;
 *  - idempotente (secondo `--apply` → 0 operazioni);
 *  - verifica post-retention: 0 righe in scope.
 *
 * Il test del guard production gira **sempre** (nessun DB): lo script rifiuta
 * l'host production senza `--allow-prod` prima di connettersi.
 *
 *   set -a; source .env.e2e; set +a
 *   npx jest tests/scripts/retention.test.ts --maxWorkers=1
 */

const HAS_DB = Boolean(process.env.SUPABASE_DB_PASSWORD)
const describeDb = HAS_DB ? describe : describe.skip

const SCRIPT = 'scripts/retention.mjs'
const E2E_REF = 'ookipybsnjtvdrzqzpsl'
const PROD_REF = 'zdfverdwdsigizxktilz'
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com'

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

function buildDbUrl(): string {
  const host = new URL(SUPABASE_URL).hostname
  if (host !== `${E2E_REF}.supabase.co`) {
    throw new Error(`Guard: host ${host} != fantacer-e2e`)
  }
  const ref = host.split('.')[0]
  return `postgresql://postgres.${ref}:${encodeURIComponent(DB_PASSWORD)}@${POOLER_HOST}:5432/postgres`
}

function prodDbUrl(): string {
  return `postgresql://postgres.${PROD_REF}:secret@${POOLER_HOST}:5432/postgres`
}

interface ScopeCounts {
  voterSessions: number
  eventPrincipals: number
  bootstrapNonces: number
  voteSessionsPii: number
  auditLogsPii: number
}

interface RetentionReport {
  mode: string
  target: string
  eventId: string
  batch: string
  retainsVoteSessions: boolean
  horizon: { days: number; endsAt: string | null; cutoff: string; reached: boolean; source: string }
  before: ScopeCounts
  after: ScopeCounts
  deleted: { voterSessions: number; eventPrincipals: number; bootstrapNonces: number }
  anonymized: { voteSessionsPii: number; auditLogsPii: number }
  signalKeys: Array<{
    keyId: string
    sessions: number
    inScope: number
    remaining: number
    destroyEligible: boolean
  }>
  voteSessions: { before: number; after: number }
  remaining: ScopeCounts
  durationMs: number
}

function runScript(
  extra: string[] = [],
  extraEnv: Record<string, string> = {},
): { status: number | null; report: RetentionReport | null; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, [SCRIPT, '--json', ...extra], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
  })
  const lines = (res.stdout ?? '').trim().split('\n').filter(Boolean)
  let report: RetentionReport | null = null
  if (lines.length) {
    try {
      report = JSON.parse(lines[lines.length - 1]) as RetentionReport
    } catch {
      report = null
    }
  }
  return { status: res.status, report, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

describe('retention — guard host (nessun DB)', () => {
  it('rifiuta production senza --allow-prod prima di connettersi', () => {
    const res = runScript([], { RETENTION_DB_URL: prodDbUrl() })
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('production')
    expect(res.stderr).toContain('--allow-prod')
  })

  it('--apply su production resta rifiutato senza --allow-prod', () => {
    const res = runScript(['--apply'], { RETENTION_DB_URL: prodDbUrl() })
    expect(res.status).not.toBe(0)
    expect(res.stderr).toContain('production')
  })
})

describeDb('retention (integrazione E2E)', () => {
  let db: Client
  let eventId = ''
  let pExpired = ''
  let pFresh = ''
  let pVotes = ''
  let c1 = ''
  let c2 = ''
  let c3 = ''

  const RUN = `ret${Date.now().toString(36)}`
  const BATCH = `RET_${RUN}`
  const KEY_OLD = `${RUN}-k1`
  const KEY_NEW = `${RUN}-k2`
  const FP_OLD = `${RUN}-vote-old`
  const FP_FRESH = `${RUN}-vote-fresh`
  const FP_LEGACY = `${RUN}-vote-legacy`
  const NONCE_OLD = `${RUN}-nonce-old`
  const NONCE_CONSUMED = `${RUN}-nonce-consumed`
  const NONCE_FRESH = `${RUN}-nonce-fresh`
  const AUDIT_TYPE = `${RUN}-audit`

  async function fixtureRowCounts(): Promise<{
    voterSessions: number
    principals: number
    nonces: number
    piiOld: number
  }> {
    const vs = await db.query<{ n: string }>(
      'select count(*)::bigint n from public.voter_sessions where event_id = $1',
      [eventId],
    )
    const ep = await db.query<{ n: string }>(
      'select count(*)::bigint n from public.event_principals where event_id = $1',
      [eventId],
    )
    const bn = await db.query<{ n: string }>(
      'select count(*)::bigint n from public.bootstrap_nonces where nonce = any($1::text[])',
      [[NONCE_OLD, NONCE_CONSUMED, NONCE_FRESH]],
    )
    const pii = await db.query<{ n: string }>(
      `select count(*)::bigint n from public.vote_sessions
        where fingerprint = any($1::text[]) and (ip_hash is not null or user_agent is not null)`,
      [[FP_OLD, FP_LEGACY]],
    )
    return {
      voterSessions: Number(vs.rows[0].n),
      principals: Number(ep.rows[0].n),
      nonces: Number(bn.rows[0].n),
      piiOld: Number(pii.rows[0].n),
    }
  }

  beforeAll(async () => {
    if (!SUPABASE_URL || !DB_PASSWORD) {
      throw new Error('Credenziali E2E mancanti (.env.e2e o env).')
    }
    db = new pg.Client({ connectionString: buildDbUrl() })
    await db.connect()

    const ev = await db.query<{ id: string }>(
      `insert into public.events (slug, name, batch, status, ends_at)
       values ($1, $2, $3, 'draft', now() - interval '30 days') returning id`,
      [`ret-${RUN}`, `Retention ${RUN}`, BATCH],
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

    const ps = await db.query<{ id: string }>(
      `insert into public.event_principals (event_id, legacy_fingerprint)
       values ($1, $2), ($1, $3), ($1, $4) returning id`,
      [eventId, `${RUN}-p-expired`, `${RUN}-p-fresh`, `${RUN}-p-votes`],
    )
    pExpired = ps.rows[0].id
    pFresh = ps.rows[1].id
    pVotes = ps.rows[2].id

    // Sessioni: 2 oltre l'orizzonte (scaduta + revocata), 1 fresca.
    await db.query(
      `insert into public.voter_sessions
         (event_id, principal_id, token_hash, key_id, expires_at, revoked_at)
       values
         ($1, $2, $5, $8, now() - interval '40 days', null),
         ($1, $3, $6, $8, now() + interval '30 days', now() - interval '40 days'),
         ($1, $4, $7, $9, now() + interval '30 days', null)`,
      [eventId, pExpired, pVotes, pFresh, `${RUN}-tok-1`, `${RUN}-tok-2`, `${RUN}-tok-3`, KEY_OLD, KEY_NEW],
    )

    // Voti: uno vecchio (PII in scope, mai cancellato), uno fresco, uno legacy
    // senza evento (event_id null).
    await db.query(
      `insert into public.vote_sessions
         (fingerprint, company1_id, company2_id, company3_id, created_at, event_id, principal_id, ip_hash, user_agent)
       values
         ($1, $4, $5, $6, now() - interval '40 days', $7, $8, 'iphash-old', 'ua-old'),
         ($2, $4, $5, $6, now(), $7, $9, 'iphash-fresh', 'ua-fresh'),
         ($3, $4, $5, $6, now() - interval '40 days', null, null, 'iphash-legacy', 'ua-legacy')`,
      [FP_OLD, FP_FRESH, FP_LEGACY, c1, c2, c3, eventId, pVotes, pFresh],
    )

    // Nonce: scaduto, consumato da >1h, fresco.
    await db.query(
      `insert into public.bootstrap_nonces (nonce, purpose, created_at, expires_at, consumed_at)
       values
         ($1, 'bootstrap', now() - interval '2 days', now() - interval '2 days', null),
         ($2, 'bootstrap', now() - interval '3 hours', now() + interval '1 hour', now() - interval '2 hours'),
         ($3, 'bootstrap', now(), now() + interval '10 minutes', null)`,
      [NONCE_OLD, NONCE_CONSUMED, NONCE_FRESH],
    )

    // Audit: una riga vecchia con PII (in scope), una fresca.
    await db.query(
      `insert into public.audit_logs (event_type, fingerprint, ip_address, user_agent, created_at)
       values
         ($1, $2, '1.2.3.4', 'ua-audit', now() - interval '40 days'),
         ($1, $3, '5.6.7.8', 'ua-audit-fresh', now())`,
      [AUDIT_TYPE, `${RUN}-audit-old`, `${RUN}-audit-fresh`],
    )
  })

  afterAll(async () => {
    if (!db) return
    try {
      await db.query('delete from public.voter_sessions where event_id = $1', [eventId])
      await db.query('delete from public.vote_sessions where fingerprint = any($1::text[])', [
        [FP_OLD, FP_FRESH, FP_LEGACY],
      ])
      await db.query('delete from public.event_principals where event_id = $1', [eventId])
      await db.query('delete from public.bootstrap_nonces where nonce = any($1::text[])', [
        [NONCE_OLD, NONCE_CONSUMED, NONCE_FRESH],
      ])
      await db.query('delete from public.audit_logs where event_type = $1', [AUDIT_TYPE])
      await db.query('delete from public.companies where batch = $1', [BATCH])
      await db.query('delete from public.events where id = $1', [eventId])
    } finally {
      await db.end()
    }
  })

  it('dry-run: riporta i candidati e non scrive nulla', async () => {
    const beforeCounts = await fixtureRowCounts()
    const { status, report } = runScript(['--event-id', eventId])

    expect(status).toBe(0)
    expect(report).not.toBeNull()
    expect(report!.mode).toBe('dry-run')
    expect(report!.eventId).toBe(eventId)
    expect(report!.retainsVoteSessions).toBe(true)
    expect(report!.horizon.reached).toBe(true)

    expect(report!.before.voterSessions).toBe(2)
    expect(report!.before.eventPrincipals).toBe(1)
    expect(report!.before.voteSessionsPii).toBe(2)
    expect(report!.before.bootstrapNonces).toBeGreaterThanOrEqual(2)
    expect(report!.before.auditLogsPii).toBeGreaterThanOrEqual(1)

    const k1 = report!.signalKeys.find((k) => k.keyId === KEY_OLD)
    const k2 = report!.signalKeys.find((k) => k.keyId === KEY_NEW)
    expect(k1).toMatchObject({ sessions: 2, inScope: 2, remaining: 0, destroyEligible: true })
    expect(k2).toMatchObject({ sessions: 1, inScope: 0, remaining: 1, destroyEligible: false })

    // Nessuna scrittura.
    const afterCounts = await fixtureRowCounts()
    expect(afterCounts).toEqual(beforeCounts)
  })

  it('--apply: elimina solo le righe oltre l\'orizzonte e anonimizza le PII legacy', async () => {
    const { status, report } = runScript(['--event-id', eventId, '--apply'])

    expect(status).toBe(0)
    expect(report!.mode).toBe('apply')
    expect(report!.deleted.voterSessions).toBe(2)
    expect(report!.deleted.eventPrincipals).toBe(1)
    expect(report!.deleted.bootstrapNonces).toBeGreaterThanOrEqual(2)
    expect(report!.anonymized.voteSessionsPii).toBeGreaterThanOrEqual(2)
    expect(report!.anonymized.auditLogsPii).toBeGreaterThanOrEqual(1)

    // Sessione fresca e principal con voto/sessione fresca sopravvivono.
    const sessions = await db.query<{ id: string }>(
      'select id from public.voter_sessions where event_id = $1',
      [eventId],
    )
    expect(sessions.rows).toHaveLength(1)

    const principals = await db.query<{ id: string }>(
      'select id from public.event_principals where event_id = $1 order by created_at',
      [eventId],
    )
    const principalIds = principals.rows.map((r) => r.id)
    expect(principalIds).not.toContain(pExpired)
    expect(principalIds).toContain(pFresh)
    expect(principalIds).toContain(pVotes)

    const nonces = await db.query<{ nonce: string }>(
      'select nonce from public.bootstrap_nonces where nonce = any($1::text[])',
      [[NONCE_OLD, NONCE_CONSUMED, NONCE_FRESH]],
    )
    expect(nonces.rows.map((r) => r.nonce)).toEqual([NONCE_FRESH])

    // Voti mai cancellati; PII legacy azzerata; il voto fresco resta intatto.
    const votes = await db.query<{
      fingerprint: string
      ip_hash: string | null
      user_agent: string | null
    }>(
      'select fingerprint, ip_hash, user_agent from public.vote_sessions where fingerprint = any($1::text[])',
      [[FP_OLD, FP_FRESH, FP_LEGACY]],
    )
    const byFp = Object.fromEntries(votes.rows.map((r) => [r.fingerprint, r]))
    expect(Object.keys(byFp).sort()).toEqual([FP_OLD, FP_FRESH, FP_LEGACY].sort())
    expect(byFp[FP_OLD].ip_hash).toBeNull()
    expect(byFp[FP_OLD].user_agent).toBeNull()
    expect(byFp[FP_LEGACY].ip_hash).toBeNull()
    expect(byFp[FP_LEGACY].user_agent).toBeNull()
    expect(byFp[FP_FRESH].ip_hash).toBe('iphash-fresh')
    expect(byFp[FP_FRESH].user_agent).toBe('ua-fresh')

    // audit_logs: vecchia anonimizzata, fresca intatta.
    const audit = await db.query<{
      fingerprint: string | null
      ip_address: string | null
      user_agent: string | null
    }>('select fingerprint, ip_address, user_agent from public.audit_logs where event_type = $1 order by created_at', [
      AUDIT_TYPE,
    ])
    const oldAudit = audit.rows.find((r) => r.fingerprint === 'redacted')
    expect(oldAudit).toBeDefined()
    expect(oldAudit!.ip_address).toBeNull()
    expect(oldAudit!.user_agent).toBeNull()
    expect(audit.rows.some((r) => r.user_agent === 'ua-audit-fresh')).toBe(true)

    // Invariante: nessun voto cancellato.
    expect(report!.voteSessions.after).toBe(report!.voteSessions.before)
    // Post-retention: 0 in scope.
    expect(Object.values(report!.remaining).every((n) => n === 0)).toBe(true)
  })

  it('idempotente: il secondo --apply non fa nulla', async () => {
    const { status, report } = runScript(['--event-id', eventId, '--apply'])

    expect(status).toBe(0)
    expect(report!.deleted).toEqual({ voterSessions: 0, eventPrincipals: 0, bootstrapNonces: 0 })
    expect(report!.anonymized).toEqual({ voteSessionsPii: 0, auditLogsPii: 0 })
    expect(Object.values(report!.remaining).every((n) => n === 0)).toBe(true)
  })

  it('--verify: 0 righe in scope dopo la retention', () => {
    const { status, report } = runScript(['--event-id', eventId, '--verify'])
    expect(status).toBe(0)
    expect(report!.mode).toBe('verify')
    expect(Object.values(report!.remaining).every((n) => n === 0)).toBe(true)
  })
})
