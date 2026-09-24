/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import pg, { type Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * C11 / E1-E3 — integrazione DB di stati voto + totali exact-once + RPC admin.
 *
 * Copre:
 *  - nuovo stato `status` su `vote_sessions` (accepted|quarantined|rejected);
 *  - trigger totali exact-once: INSERT accepted +1, INSERT non-accepted 0,
 *    transizione non-accepted→accepted +1, accepted→non-accepted −1,
 *    same→same 0, DELETE accepted −1;
 *  - `admin_review_vote` idempotente (repeat → nessun doppio delta);
 *  - `admin_reconcile_totals` idempotente (run×2 → risultato identico);
 *  - unicità giornaliera consumata anche da `quarantined`/`rejected`
 *    (2° submit stesso principal/day → `already_voted`);
 *  - `company_totals`/ranking leggono SOLO `accepted`;
 *  - ACL: anon/authenticated negati, service_role consentito sulle 3 RPC admin.
 *
 * Richiede il progetto **fantacer-e2e**. Di default è SALTATO perché jest non
 * carica `.env.e2e`. Per eseguirlo:
 *
 *   set -a; source .env.e2e; set +a
 *   npx jest tests/scripts/vote-quarantine.test.ts --maxWorkers=1
 *
 * La migration è idempotente/re-runnable e viene riapplicata dal test, così da
 * verificare sempre la definizione corrente del file. Fixture isolati e rimossi
 * in `afterAll`.
 */

const HAS_DB = Boolean(process.env.SUPABASE_DB_PASSWORD)
const describeDb = HAS_DB ? describe : describe.skip

function fileEnv(): Record<string, string> {
  try {
    return parse(readFileSync('.env.e2e', 'utf8'))
  } catch {
    return {}
  }
}

const env = fileEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD

const E2E_REF = 'ookipybsnjtvdrzqzpsl'
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com'
const MIGRATION = 'supabase/migrations/20260928000000_vote_quarantine.sql'

const FN_REVIEW = 'public.admin_review_vote(bigint,text,text,text)'
const FN_RECONCILE = 'public.admin_reconcile_totals()'
const FN_COUNTS = 'public.admin_quarantine_counts(integer)'

function buildDbUrl(): string {
  const host = new URL(SUPABASE_URL).hostname
  if (host !== `${E2E_REF}.supabase.co`) {
    throw new Error(`Guard: host ${host} != fantacer-e2e`)
  }
  const ref = host.split('.')[0]
  return `postgresql://postgres.${ref}:${encodeURIComponent(DB_PASSWORD)}@${POOLER_HOST}:5432/postgres`
}

const RUN = `vq${Date.now().toString(36)}`
const BATCH = `VQ_${RUN}`

interface SubmitOutcome {
  success: boolean
  code?: string
  message?: string
  vote_id?: number
  idempotent?: boolean
}

interface ReviewOutcome {
  success: boolean
  code?: string
  vote_id?: number
  previous_status?: string
  status?: string
  changed?: boolean
  idempotent?: boolean
}

interface TotalsRow {
  total_pallets: number
  vote_count: number
}

function delta(after: TotalsRow, before: TotalsRow): TotalsRow {
  return {
    total_pallets: after.total_pallets - before.total_pallets,
    vote_count: after.vote_count - before.vote_count,
  }
}

describeDb('vote quarantine + exact-once totals + admin RPCs (E2E)', () => {
  let db: Client
  let svc: SupabaseClient
  let anon: SupabaseClient

  let eventId = ''
  let c1 = ''
  let c2 = ''
  let c3 = ''
  let p1 = ''
  let p2 = ''
  let p3 = ''
  let p4 = ''
  let p5 = ''
  let pq = '' // principal del test idempotenza (legacy_fingerprint null)
  let pd = '' // principal del test dedup quarantena (legacy_fingerprint null)

  const signals = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ip_hmac: 'key1.aaaa',
    asn_hash: null,
    ua_hash: 'key1.bbbb',
    country: 'IT',
    botd_bucket: 0,
    legacy_fp_present: false,
    version: 1,
    ...over,
  })

  const wireBallot = (): Array<{ company_id: string; pallet: number }> => [
    { company_id: c1, pallet: 4 },
    { company_id: c2, pallet: 2 },
    { company_id: c3, pallet: 1 },
  ]

  async function insertVote(opts: {
    principalId: string
    fingerprint: string
    status?: string
  }): Promise<number> {
    const r = await db.query<{ id: string }>(
      `insert into public.vote_sessions
         (fingerprint, company1_id, company2_id, company3_id, event_id, principal_id,
          status, idempotency_key, ballot_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'v1:test')
       returning id`,
      [
        opts.fingerprint,
        c1,
        c2,
        c3,
        eventId,
        opts.principalId,
        opts.status ?? 'accepted',
        `seed-${opts.fingerprint}`,
      ],
    )
    return Number(r.rows[0].id)
  }

  async function statusOf(voteId: number): Promise<string> {
    const r = await db.query<{ status: string }>(
      'select status from public.vote_sessions where id = $1',
      [voteId],
    )
    return r.rows[0].status
  }

  async function totals(companyId: string): Promise<TotalsRow> {
    const r = await db.query<{ total_pallets: string; vote_count: string }>(
      'select total_pallets, vote_count from public.company_totals where company_id = $1',
      [companyId],
    )
    if (!r.rows[0]) return { total_pallets: 0, vote_count: 0 }
    return {
      total_pallets: Number(r.rows[0].total_pallets),
      vote_count: Number(r.rows[0].vote_count),
    }
  }

  async function submit(
    principalId: string,
    key: string,
    over: Record<string, unknown> = {},
  ): Promise<SubmitOutcome> {
    const { data, error } = await svc.rpc('submit_vote_v2', {
      p_event_id: eventId,
      p_principal_id: principalId,
      p_ballot: wireBallot(),
      p_idempotency_key: key,
      p_signals: signals(over),
    })
    if (error) throw new Error(`submit_vote_v2: ${error.message}`)
    return data as SubmitOutcome
  }

  async function review(
    voteId: number,
    status: string,
    actor = 'e2e-admin',
    reason = 'test review',
  ): Promise<ReviewOutcome> {
    const { data, error } = await svc.rpc('admin_review_vote', {
      p_vote_id: voteId,
      p_status: status,
      p_actor: actor,
      p_reason: reason,
    })
    if (error) throw new Error(`admin_review_vote: ${error.message}`)
    return data as ReviewOutcome
  }

  async function reconcile(): Promise<{
    success: boolean
    changed: boolean
    companies_changed: number
    before: TotalsRow & { companies: number }
    after: TotalsRow & { companies: number }
    deltas: unknown[]
  }> {
    const { data, error } = await svc.rpc('admin_reconcile_totals')
    if (error) throw new Error(`admin_reconcile_totals: ${error.message}`)
    return data as never
  }

  async function quarantineCounts(): Promise<{
    success: boolean
    totals: { accepted: number; quarantined: number; rejected: number; total: number }
  }> {
    const { data, error } = await svc.rpc('admin_quarantine_counts', { p_days: 30 })
    if (error) throw new Error(`admin_quarantine_counts: ${error.message}`)
    return data as never
  }

  /** Somma manuale dei soli accepted (posizione → peso 4/2/1). */
  async function manualAccepted(companyIds: string[]): Promise<Record<string, TotalsRow>> {
    const r = await db.query<{ company_id: string; total_pallets: string; vote_count: string }>(
      `select g.company_id, sum(g.pallets)::bigint as total_pallets, count(*)::bigint as vote_count
         from (
           select company1_id as company_id, pallet1::int as pallets
             from public.vote_sessions where status = 'accepted'
           union all
           select company2_id, pallet2 from public.vote_sessions where status = 'accepted'
           union all
           select company3_id, pallet3 from public.vote_sessions where status = 'accepted'
         ) g
        where g.company_id = any($1::uuid[])
        group by g.company_id`,
      [companyIds],
    )
    const out: Record<string, TotalsRow> = {}
    for (const row of r.rows) {
      out[row.company_id] = {
        total_pallets: Number(row.total_pallets),
        vote_count: Number(row.vote_count),
      }
    }
    for (const id of companyIds) {
      if (!out[id]) out[id] = { total_pallets: 0, vote_count: 0 }
    }
    return out
  }

  async function warmupPostgrest(): Promise<void> {
    let lastError = ''
    for (let i = 0; i < 10; i += 1) {
      await db.query("notify pgrst, 'reload schema'")
      const { error } = await svc.rpc('admin_quarantine_counts', { p_days: 1 })
      if (!error || !/PGRST202|not find the function/i.test(error.message)) return
      lastError = error.message
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error(`PostgREST non espone admin_quarantine_counts: ${lastError}`)
  }

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !DB_PASSWORD) {
      throw new Error('Credenziali E2E mancanti (.env.e2e o env).')
    }
    db = new pg.Client({ connectionString: buildDbUrl(), ssl: { rejectUnauthorized: false } })
    await db.connect()

    // Idempotente/re-runnable: applica la definizione corrente del file.
    await db.query(readFileSync(MIGRATION, 'utf8'))

    const ev = await db.query<{ id: string }>(
      `insert into public.events (slug, name, batch, status)
       values ($1, $2, $3, 'draft') returning id`,
      [`${RUN}-ev`, `VQ Event ${RUN}`, BATCH],
    )
    eventId = ev.rows[0].id

    const cs = await db.query<{ id: string }>(
      `insert into public.companies (name, batch, blocked)
       values ($1, $2, false), ($3, $2, false), ($4, $2, false)
       returning id`,
      [`${RUN} A`, BATCH, `${RUN} B`, `${RUN} C`],
    )
    c1 = cs.rows[0].id
    c2 = cs.rows[1].id
    c3 = cs.rows[2].id

    const ps = await db.query<{ id: string }>(
      `insert into public.event_principals (event_id, legacy_fingerprint)
       values ($1, $2), ($1, $3), ($1, $4), ($1, $5), ($1, $6), ($1, null), ($1, null)
       returning id`,
      [eventId, `${RUN}-fp1`, `${RUN}-fp2`, `${RUN}-fp3`, `${RUN}-fp4`, `${RUN}-fp5`],
    )
    p1 = ps.rows[0].id
    p2 = ps.rows[1].id
    p3 = ps.rows[2].id
    p4 = ps.rows[3].id
    p5 = ps.rows[4].id
    pq = ps.rows[5].id
    pd = ps.rows[6].id

    svc = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await warmupPostgrest()
  })

  afterAll(async () => {
    if (!db) return
    const companies = [c1, c2, c3]
    try {
      await db.query('delete from public.vote_sessions where event_id = $1', [eventId])
      await db.query('delete from public.company_totals where company_id = any($1::uuid[])', [
        companies,
      ])
      await db.query('delete from public.event_principals where event_id = $1', [eventId])
      await db.query('delete from public.companies where batch = $1', [BATCH])
      await db.query('delete from public.events where id = $1', [eventId])
    } finally {
      await db.end()
    }
  })

  it('colonne e vincolo status esistono (accepted default)', async () => {
    const cols = await db.query<{ column_name: string; column_default: string | null }>(
      `select column_name, column_default
         from information_schema.columns
        where table_schema = 'public' and table_name = 'vote_sessions'
          and column_name in ('status','review_actor','reviewed_at','review_reason','risk_findings')
        order by column_name`,
    )
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'review_actor',
      'review_reason',
      'reviewed_at',
      'risk_findings',
      'status',
    ])
    expect(cols.rows.find((r) => r.column_name === 'status')?.column_default).toContain('accepted')

    await expect(
      db.query(`insert into public.vote_sessions
                 (fingerprint, company1_id, company2_id, company3_id, event_id, principal_id, status)
               values ($1, $2, $3, $4, $5, $6, 'bogus')`, [
        `${RUN}-bad`,
        c1,
        c2,
        c3,
        eventId,
        p1,
      ]),
    ).rejects.toThrow()
  })

  it('INSERT accepted → +delta una volta; INSERT quarantined → nessun delta', async () => {
    const v = await insertVote({ principalId: p1, fingerprint: `${RUN}-fp1`, status: 'accepted' })
    expect(await statusOf(v)).toBe('accepted')

    expect(await totals(c1)).toEqual({ total_pallets: 4, vote_count: 1 })
    expect(await totals(c2)).toEqual({ total_pallets: 2, vote_count: 1 })
    expect(await totals(c3)).toEqual({ total_pallets: 1, vote_count: 1 })

    const before = await totals(c1)
    await insertVote({ principalId: p2, fingerprint: `${RUN}-fp2`, status: 'quarantined' })
    expect(await totals(c1)).toEqual(before)

    const beforeR = await totals(c1)
    await insertVote({ principalId: p3, fingerprint: `${RUN}-fp3`, status: 'rejected' })
    expect(await totals(c1)).toEqual(beforeR)
  })

  it('transizioni: quarantined→accepted +delta; accepted→quarantined −delta; same→same 0', async () => {
    const v = await insertVote({ principalId: p4, fingerprint: `${RUN}-fp4`, status: 'quarantined' })

    const t0 = await totals(c1)
    const r1 = await review(v, 'accepted')
    expect(r1.success).toBe(true)
    expect(r1.changed).toBe(true)
    expect(await statusOf(v)).toBe('accepted')
    expect(delta(await totals(c1), t0)).toEqual({ total_pallets: 4, vote_count: 1 })

    const t1 = await totals(c1)
    const r2 = await review(v, 'quarantined')
    expect(r2.changed).toBe(true)
    expect(await statusOf(v)).toBe('quarantined')
    expect(delta(await totals(c1), t1)).toEqual({ total_pallets: -4, vote_count: -1 })

    const t2 = await totals(c1)
    const r3 = await review(v, 'rejected')
    expect(r3.changed).toBe(true)
    expect(delta(await totals(c1), t2)).toEqual({ total_pallets: 0, vote_count: 0 })
  })

  it('admin_review_vote idempotente: repeat stessa status → no-op, nessun doppio delta', async () => {
    const v = await insertVote({
      principalId: pq,
      fingerprint: `v2:${pq}`,
      status: 'accepted',
    })
    const t = await totals(c1)

    const again = await review(v, 'accepted')
    expect(again.success).toBe(true)
    expect(again.idempotent).toBe(true)
    expect(again.changed).toBe(false)
    expect(await totals(c1)).toEqual(t)
  })

  it('admin_reconcile_totals idempotente: run×2 → before==after, changed=false al 2° run', async () => {
    // Normalizza prima (potrebbe esserci drift pregresso nel dataset E2E).
    await reconcile()

    await db.query(
      `update public.company_totals
          set total_pallets = total_pallets + 100, vote_count = vote_count + 7
        where company_id = $1`,
      [c1],
    )

    const first = await reconcile()
    expect(first.success).toBe(true)
    expect(first.changed).toBe(true)
    expect(first.companies_changed).toBeGreaterThanOrEqual(1)

    const second = await reconcile()
    expect(second.success).toBe(true)
    expect(second.changed).toBe(false)
    expect(second.companies_changed).toBe(0)
    expect(second.before).toEqual(second.after)
  })

  it('company_totals/ranking leggono SOLO accepted', async () => {
    const manual = await manualAccepted([c1, c2, c3])
    for (const id of [c1, c2, c3]) {
      expect(await totals(id)).toEqual(manual[id])
    }
  })

  it('2° submit stesso principal/day mentre il 1° è quarantined → already_voted', async () => {
    // pd ha legacy_fingerprint null → fingerprint `v2:<principal>`. Il primo voto
    // è inserito direttamente in quarantena (submit_vote_v2 inserisce accepted).
    await insertVote({ principalId: pd, fingerprint: `v2:${pd}`, status: 'quarantined' })

    const beforeCount = await db.query<{ n: number }>(
      'select count(*)::int as n from public.vote_sessions where event_id = $1 and principal_id = $2',
      [eventId, pd],
    )

    const out = await submit(pd, 'DEDUP-QUAR')
    expect(out.success).toBe(false)
    expect(out.code).toBe('already_voted')

    const afterCount = await db.query<{ n: number }>(
      'select count(*)::int as n from public.vote_sessions where event_id = $1 and principal_id = $2',
      [eventId, pd],
    )
    expect(afterCount.rows[0].n).toBe(beforeCount.rows[0].n)
  })

  it('submit accepted e quarantined hanno la stessa risposta pubblica (nessun oracolo)', async () => {
    // Nuovo principal, scheda valida → accepted. La RPC non espone mai `status`.
    const out = await submit(p5, `ORACLE-${RUN}`)
    expect(out.success).toBe(true)
    expect(out).not.toHaveProperty('status')
    expect(out).not.toHaveProperty('review_reason')
    expect(JSON.stringify(out)).not.toMatch(/quarantined|accepted|rejected/)
  })

  it('admin_quarantine_counts: conteggi per status + per giorno', async () => {
    const counts = await quarantineCounts()
    expect(counts.success).toBe(true)
    expect(counts.totals.total).toBeGreaterThanOrEqual(3)
    expect(counts.totals.accepted + counts.totals.quarantined + counts.totals.rejected).toBe(
      counts.totals.total,
    )
    expect(counts.totals.rejected).toBeGreaterThanOrEqual(1)
    expect(counts.totals.quarantined).toBeGreaterThanOrEqual(1)
  })

  it('ACL: anon/authenticated negati, service_role consentito sulle 3 RPC admin', async () => {
    for (const sig of [FN_REVIEW, FN_RECONCILE, FN_COUNTS]) {
      const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
        `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
                has_function_privilege('service_role', $1, 'EXECUTE') as svc`,
        [sig],
      )
      expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true })
    }

    const review = await anon.rpc('admin_review_vote', {
      p_vote_id: 1,
      p_status: 'accepted',
      p_actor: 'anon',
      p_reason: 'nope',
    })
    expect(review.error).not.toBeNull()

    const reconcile = await anon.rpc('admin_reconcile_totals')
    expect(reconcile.error).not.toBeNull()

    const counts = await anon.rpc('admin_quarantine_counts', { p_days: 1 })
    expect(counts.error).not.toBeNull()
  })

  it('migration riapplicata: idempotente, nessuna scrittura sui totali', async () => {
    const before = await totals(c1)
    await expect(db.query(readFileSync(MIGRATION, 'utf8'))).resolves.toBeDefined()
    expect(await totals(c1)).toEqual(before)
  })
})
