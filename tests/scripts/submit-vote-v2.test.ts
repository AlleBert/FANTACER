/**
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import pg, { type Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ballotHash, type BallotEntry } from '../../src/lib/vote-ballot'

/**
 * C09 — integrazione DB di `public.submit_vote_v2`.
 *
 * Copre: inserimento accettato, idempotenza (stessa key/scheda → stesso esito,
 * nessuna nuova riga; stessa key/scheda diversa → `idempotency_conflict`),
 * dedup giornaliera (`already_voted`), validazione segnali/scheda, errori
 * evento/principal/aziende, ACL (anon/authenticated negati) e concorrenza.
 *
 * Richiede il progetto **fantacer-e2e**. Di default è SALTATO perché jest non
 * carica `.env.e2e`. Per eseguirlo:
 *
 *   set -a; source .env.e2e; set +a
 *   npx jest tests/scripts/submit-vote-v2.test.ts --maxWorkers=1
 *
 * Se la migration `20260927000000_submit_vote_v2.sql` non è applicata, il test
 * la applica (idempotente) e ricarica lo schema PostgREST. Tutti i fixture
 * sono isolati e rimossi in `afterAll`.
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
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD

const E2E_REF = 'ookipybsnjtvdrzqzpsl'
const POOLER_HOST = 'aws-1-eu-west-1.pooler.supabase.com'
const MIGRATION = 'supabase/migrations/20260927000000_submit_vote_v2.sql'
const FN_SIG = 'public.submit_vote_v2(uuid,uuid,jsonb,text,jsonb)'

function buildDbUrl(): string {
  const host = new URL(SUPABASE_URL).hostname
  if (host !== `${E2E_REF}.supabase.co`) {
    throw new Error(`Guard: host ${host} != fantacer-e2e`)
  }
  const ref = host.split('.')[0]
  return `postgresql://postgres.${ref}:${encodeURIComponent(DB_PASSWORD)}@${POOLER_HOST}:5432/postgres`
}

const RUN = `sv2${Date.now().toString(36)}`
const BATCH = `SV2_${RUN}`
const OTHER_BATCH = `SV2_OTHER_${RUN}`

interface RpcOutcome {
  success: boolean
  code?: string
  message?: string
  vote_id?: number
  idempotent?: boolean
  ballot_hash?: string
}

describeDb('submit_vote_v2 (integrazione E2E)', () => {
  let db: Client
  let svc: SupabaseClient

  let event1 = ''
  let event2 = ''
  let cA = ''
  let cB = ''
  let cC = ''
  let cBlocked = ''
  let cOther = ''
  let p1 = ''
  let p2 = ''
  let pOther = ''

  let voteId1 = 0

  const romeDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

  function signals(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ip_hmac: 'key1.aaaa',
      asn_hash: null,
      ua_hash: 'key1.bbbb',
      country: 'IT',
      botd_bucket: 0,
      legacy_fp_present: false,
      version: 1,
      ...over,
    }
  }

  function ballot(entries: BallotEntry[]): BallotEntry[] {
    return entries
  }

  const B1: BallotEntry[] = [
    { companyId: '', pallet: 4 },
    { companyId: '', pallet: 2 },
    { companyId: '', pallet: 1 },
  ]

  async function rpc(args: Record<string, unknown>): Promise<RpcOutcome> {
    const { data, error } = await svc.rpc('submit_vote_v2', args)
    if (error) throw new Error(`rpc ${args.p_idempotency_key}: ${error.message}`)
    return data as RpcOutcome
  }

  function call(
    eventId: string,
    principalId: string,
    key: string | null,
    ballotEntries: BallotEntry[],
    sig: Record<string, unknown>,
  ): Promise<RpcOutcome> {
    // Formato wire della RPC: `{ company_id, pallet }` (snake_case).
    const wireBallot = ballotEntries.map((e) => ({ company_id: e.companyId, pallet: e.pallet }))
    return rpc({
      p_event_id: eventId,
      p_principal_id: principalId,
      p_ballot: wireBallot,
      p_idempotency_key: key,
      p_signals: sig,
    })
  }

  async function countVotes(eventId: string): Promise<number> {
    const r = await db.query<{ n: number }>(
      'select count(*)::int as n from public.vote_sessions where event_id = $1',
      [eventId],
    )
    return r.rows[0].n
  }

  async function warmupPostgrest(): Promise<void> {
    // Forza il reload della schema cache e attende che la RPC sia risolvibile.
    let lastError = ''
    for (let i = 0; i < 10; i += 1) {
      await db.query("notify pgrst, 'reload schema'")
      const { error } = await svc.rpc('submit_vote_v2', {
        p_event_id: randomUUID(),
        p_principal_id: randomUUID(),
        p_ballot: B1,
        p_idempotency_key: `warmup-${i}`,
        p_signals: signals(),
      })
      if (!error || !/PGRST202|not find the function/i.test(error.message)) return
      lastError = error.message
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    throw new Error(`PostgREST non espone submit_vote_v2: ${lastError}`)
  }

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY || !DB_PASSWORD) {
      throw new Error('Credenziali E2E mancanti (.env.e2e o env).')
    }
    db = new pg.Client({ connectionString: buildDbUrl(), ssl: { rejectUnauthorized: false } })
    await db.connect()

    // La migration e' idempotente/re-runnable: la riapplichiamo sempre così i
    // test girano contro la definizione corrente del file (non una versione stale).
    await db.query(readFileSync(MIGRATION, 'utf8'))

    const ev = await db.query<{ id: string }>(
      `insert into public.events (slug, name, batch, status)
       values ($1, $2, $3, 'draft'), ($4, $5, $6, 'draft')
       returning id`,
      [`${RUN}-ev1`, `Event 1 ${RUN}`, BATCH, `${RUN}-ev2`, `Event 2 ${RUN}`, OTHER_BATCH],
    )
    event1 = ev.rows[0].id
    event2 = ev.rows[1].id

    const c = await db.query<{ id: string; batch: string; blocked: boolean }>(
      `insert into public.companies (name, batch, blocked)
       values ($1, $2, false), ($3, $2, false), ($4, $2, false), ($5, $2, true), ($6, $7, false)
       returning id, batch, blocked`,
      [`${RUN} A`, BATCH, `${RUN} B`, `${RUN} C`, `${RUN} BLOCKED`, `${RUN} OTHER`, OTHER_BATCH],
    )
    const inBatch = c.rows.filter((r) => r.batch === BATCH && !r.blocked)
    const blocked = c.rows.find((r) => r.blocked)
    const outBatch = c.rows.find((r) => r.batch === OTHER_BATCH)
    if (inBatch.length !== 3 || !blocked || !outBatch) {
      throw new Error('fixture aziende incompleta')
    }
    cA = inBatch[0].id
    cB = inBatch[1].id
    cC = inBatch[2].id
    cBlocked = blocked.id
    cOther = outBatch.id

    const p = await db.query<{ id: string }>(
      `insert into public.event_principals (event_id, legacy_fingerprint)
       values ($1, $2), ($1, null), ($3, $4)
       returning id`,
      [event1, `${RUN}-fp1`, event2, `${RUN}-fpother`],
    )
    p1 = p.rows[0].id
    p2 = p.rows[1].id
    pOther = p.rows[2].id

    B1[0].companyId = cA
    B1[1].companyId = cB
    B1[2].companyId = cC

    svc = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await warmupPostgrest()
  })

  afterAll(async () => {
    if (!db) return
    const events = [event1, event2].filter(Boolean)
    const companies = [cA, cB, cC, cBlocked, cOther].filter(Boolean)
    try {
      await db.query('delete from public.vote_sessions where event_id = any($1::uuid[])', [events])
      await db.query(
        `delete from public.audit_logs
          where metadata->>'event_id' = any($1::text[])`,
        [events],
      )
      await db.query(
        'delete from public.daily_stats where company_id = any($1::uuid[]) and date = $2',
        [companies, romeDate],
      )
      await db.query('delete from public.company_totals where company_id = any($1::uuid[])', [
        companies,
      ])
      await db.query('delete from public.event_principals where event_id = any($1::uuid[])', [events])
      await db.query('delete from public.companies where batch = any($1::text[])', [
        [BATCH, OTHER_BATCH],
      ])
      await db.query('delete from public.events where id = any($1::uuid[])', [events])
    } finally {
      await db.end()
    }
  })

  it('success: riga accettata con hash canonico, ip_hash null e audit senza IP', async () => {
    expect(await countVotes(event1)).toBe(0)

    const out = await call(event1, p1, 'K1', ballot(B1), signals())
    expect(out.success).toBe(true)
    expect(typeof out.vote_id).toBe('number')
    voteId1 = out.vote_id as number

    const row = await db.query<{
      ballot_hash: string
      ip_hash: string | null
      fingerprint: string
      signals: Record<string, unknown>
      event_id: string
      principal_id: string
      vote_day: string
    }>(
      'select ballot_hash, ip_hash, fingerprint, signals, event_id, principal_id, vote_day::text from public.vote_sessions where id = $1',
      [voteId1],
    )
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0].ballot_hash).toBe(ballotHash(B1))
    expect(row.rows[0].ip_hash).toBeNull()
    expect(row.rows[0].fingerprint).toBe(`${RUN}-fp1`)
    expect(row.rows[0].signals).toEqual(signals())
    expect(row.rows[0].event_id).toBe(event1)
    expect(row.rows[0].principal_id).toBe(p1)
    expect(row.rows[0].vote_day).toBe(romeDate)

    const audit = await db.query<{ ip_address: string | null; user_agent: string | null; event_type: string }>(
      `select ip_address, user_agent, event_type from public.audit_logs
        where metadata->>'vote_id' = $1`,
      [String(voteId1)],
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].event_type).toBe('vote_submitted_v2')
    expect(audit.rows[0].ip_address).toBeNull()
    expect(audit.rows[0].user_agent).toBeNull()

    const stats = await db.query<{ n: number }>(
      'select count(*)::int as n from public.daily_stats where company_id = any($1::uuid[]) and date = $2',
      [[cA, cB, cC], romeDate],
    )
    expect(stats.rows[0].n).toBe(3)
  })

  it('retry stessa key + stessa scheda (ordine diverso) → stesso esito, nessuna nuova riga', async () => {
    const reordered = [B1[2], B1[0], B1[1]]
    const out = await call(event1, p1, 'K1', reordered, signals())
    expect(out.success).toBe(true)
    expect(out.idempotent).toBe(true)
    expect(out.vote_id).toBe(voteId1)
    expect(await countVotes(event1)).toBe(1)
  })

  it('stessa key + scheda diversa → idempotency_conflict, nessuna scrittura', async () => {
    const different: BallotEntry[] = [
      { companyId: cA, pallet: 1 },
      { companyId: cB, pallet: 4 },
      { companyId: cC, pallet: 2 },
    ]
    const out = await call(event1, p1, 'K1', different, signals())
    expect(out.success).toBe(false)
    expect(out.code).toBe('idempotency_conflict')
    expect(await countVotes(event1)).toBe(1)
  })

  it('key diversa, stesso principal/giorno → already_voted', async () => {
    const out = await call(event1, p1, 'K2', ballot(B1), signals())
    expect(out.success).toBe(false)
    expect(out.code).toBe('already_voted')
    expect(await countVotes(event1)).toBe(1)
  })

  it('segnali con chiave sconosciuta o tipo errato → invalid_signals', async () => {
    const unknownKey = await call(event1, p2, 'S1', ballot(B1), signals({ score: 99 }))
    expect(unknownKey.code).toBe('invalid_signals')

    const wrongBucket = await call(event1, p2, 'S2', ballot(B1), signals({ botd_bucket: 9 }))
    expect(wrongBucket.code).toBe('invalid_signals')

    const missingKey = signals()
    delete missingKey.version
    const missing = await call(event1, p2, 'S3', ballot(B1), missingKey)
    expect(missing.code).toBe('invalid_signals')

    const wrongFlag = await call(event1, p2, 'S4', ballot(B1), signals({ legacy_fp_present: 'yes' }))
    expect(wrongFlag.code).toBe('invalid_signals')

    expect(await countVotes(event1)).toBe(1)
  })

  it('chiave di idempotenza mancante/vuota/troppo lunga → invalid_idempotency_key', async () => {
    const missing = await call(event1, p2, null, ballot(B1), signals())
    expect(missing.success).toBe(false)
    expect(missing.code).toBe('invalid_idempotency_key')

    const empty = await call(event1, p2, '   ', ballot(B1), signals())
    expect(empty.code).toBe('invalid_idempotency_key')

    const long = await call(event1, p2, 'x'.repeat(201), ballot(B1), signals())
    expect(long.code).toBe('invalid_idempotency_key')

    expect(await countVotes(event1)).toBe(1)
  })

  it('scheda malformata → invalid_ballot', async () => {
    const two = await call(event1, p2, 'B', [B1[0], B1[1]], signals())
    expect(two.code).toBe('invalid_ballot')

    const dup = await call(
      event1,
      p2,
      'B',
      [B1[0], { ...B1[1], companyId: cA }, B1[2]],
      signals(),
    )
    expect(dup.code).toBe('invalid_ballot')

    const badPallet = await call(
      event1,
      p2,
      'B',
      [B1[0], B1[1], { ...B1[2], pallet: 3 as never }],
      signals(),
    )
    expect(badPallet.code).toBe('invalid_ballot')

    expect(await countVotes(event1)).toBe(1)
  })

  it('scheda non-array o con elementi non-oggetto → invalid_ballot (non errore generico)', async () => {
    const scalar = await rpc({
      p_event_id: event1,
      p_principal_id: p2,
      p_ballot: 'not-an-array',
      p_idempotency_key: 'RAW1',
      p_signals: signals(),
    })
    expect(scalar.success).toBe(false)
    expect(scalar.code).toBe('invalid_ballot')

    const scalarElement = await rpc({
      p_event_id: event1,
      p_principal_id: p2,
      p_ballot: [{ company_id: cA, pallet: 4 }, 'scalar', { company_id: cC, pallet: 1 }],
      p_idempotency_key: 'RAW2',
      p_signals: signals(),
    })
    expect(scalarElement.code).toBe('invalid_ballot')

    const notArraySignals = await rpc({
      p_event_id: event1,
      p_principal_id: p2,
      p_ballot: B1,
      p_idempotency_key: 'RAW3',
      p_signals: 'not-an-object',
    })
    expect(notArraySignals.code).toBe('invalid_signals')

    expect(await countVotes(event1)).toBe(1)
  })

  it('azienda fuori dal batch dell’evento → company_not_in_event', async () => {
    const mixed: BallotEntry[] = [
      { companyId: cA, pallet: 4 },
      { companyId: cB, pallet: 2 },
      { companyId: cOther, pallet: 1 },
    ]
    const out = await call(event1, p2, 'CO', mixed, signals())
    expect(out.success).toBe(false)
    expect(out.code).toBe('company_not_in_event')
    expect(await countVotes(event1)).toBe(1)
  })

  it('azienda bloccata dall’admin → company_blocked', async () => {
    const withBlocked: BallotEntry[] = [
      { companyId: cA, pallet: 4 },
      { companyId: cB, pallet: 2 },
      { companyId: cBlocked, pallet: 1 },
    ]
    const out = await call(event1, p2, 'CB', withBlocked, signals())
    expect(out.success).toBe(false)
    expect(out.code).toBe('company_blocked')
    expect(await countVotes(event1)).toBe(1)
  })

  it('principal di un altro evento → event_mismatch', async () => {
    const out = await call(event1, pOther, 'EM', ballot(B1), signals())
    expect(out.code).toBe('event_mismatch')
  })

  it('principal inesistente → principal_not_found', async () => {
    const out = await call(event1, randomUUID(), 'PNF', ballot(B1), signals())
    expect(out.code).toBe('principal_not_found')
  })

  it('evento inesistente → event_mismatch', async () => {
    const out = await call(randomUUID(), p2, 'ENF', ballot(B1), signals())
    expect(out.code).toBe('event_mismatch')
  })

  it('ACL: anon/authenticated non eseguono, service_role sì', async () => {
    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
              has_function_privilege('authenticated', $1, 'EXECUTE') as auth,
              has_function_privilege('service_role', $1, 'EXECUTE') as svc`,
      [FN_SIG],
    )
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true })

    const anon = createClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await anon.rpc('submit_vote_v2', {
      p_event_id: event1,
      p_principal_id: p2,
      p_ballot: B1,
      p_idempotency_key: 'anon',
      p_signals: signals(),
    })
    expect(error).not.toBeNull()
  })

  it('concorrenza: 10 richieste parallele stesso principal/giorno → esattamente 1 voto', async () => {
    const calls = Array.from({ length: 10 }, (_, i) =>
      call(event1, p2, `K-race-${i}`, ballot(B1), signals()),
    )
    const outcomes = await Promise.all(calls)
    const ok = outcomes.filter((o) => o.success)
    const already = outcomes.filter((o) => o.code === 'already_voted')
    expect(ok).toHaveLength(1)
    expect(already).toHaveLength(9)

    const rows = await db.query<{ n: number }>(
      'select count(*)::int as n from public.vote_sessions where event_id = $1 and principal_id = $2',
      [event1, p2],
    )
    expect(rows.rows[0].n).toBe(1)
  })

  it('migration riapplicata: idempotente, ACL invariata, nessuna scrittura', async () => {
    const before = await countVotes(event1)
    await expect(db.query(readFileSync(MIGRATION, 'utf8'))).resolves.toBeDefined()

    const r = await db.query<{ anon: boolean; svc: boolean; oid: string | null }>(
      `select has_function_privilege('anon', $1, 'EXECUTE') as anon,
              has_function_privilege('service_role', $1, 'EXECUTE') as svc,
              to_regprocedure($1)::text as oid`,
      [FN_SIG],
    )
    expect(r.rows[0].anon).toBe(false)
    expect(r.rows[0].svc).toBe(true)
    expect(r.rows[0].oid).not.toBeNull()
    expect(await countVotes(event1)).toBe(before)
  })
})
