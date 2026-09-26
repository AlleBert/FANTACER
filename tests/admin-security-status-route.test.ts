/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET } from '../src/app/api/admin/security/status/route'

jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/session-identity-server', () => ({ sessionIdentityMode: jest.fn() }))
jest.mock('@/lib/admin-security-status', () => {
  const actual = jest.requireActual('@/lib/admin-security-status')
  return { ...actual, summarizeNonces: jest.fn(actual.summarizeNonces) }
})

import { requireAdmin, toAdminError } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sessionIdentityMode } from '@/lib/session-identity-server'
import { summarizeNonces } from '@/lib/admin-security-status'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock
const mockCreateAdminClient = createAdminClient as jest.Mock
const mockSessionIdentityMode = sessionIdentityMode as jest.Mock
const mockSummarizeNonces = summarizeNonces as jest.Mock

const ADMIN_CTX = {
  user: { id: 'user-1', email: 'admin@example.com' },
  aal: 'aal2',
  role: 'admin',
}

interface QueryResult {
  count?: number | null
  data?: unknown
  error?: unknown
}

function query(result: QueryResult) {
  const q: Record<string, unknown> = {}
  q.select = jest.fn(() => q)
  q.eq = jest.fn(() => q)
  q.not = jest.fn(() => q)
  q.lt = jest.fn(() => q)
  q.is = jest.fn(() => q)
  q.gte = jest.fn(() => q)
  q.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return q
}

/**
 * Query builder dei nonce che rispetta i filtri applicati: `from('bootstrap_nonces')`
 * è usata per 4 conteggi distinti, quindi il risultato dipende da quali filtri
 * sono stati invocati (`.not`/`.lt`/`.is`+`.gte`/nessuno), non dall'ordine.
 */
function noncesQuery(results: {
  total: QueryResult
  consumed: QueryResult
  expired: QueryResult
  outstanding: QueryResult
}) {
  const state = {
    consumedNotNull: false,
    expiresBefore: false,
    consumedNull: false,
    expiresAfter: false,
  }
  const q: Record<string, unknown> = {}
  q.select = jest.fn(() => q)
  q.not = jest.fn((col: string) => {
    if (col === 'consumed_at') state.consumedNotNull = true
    return q
  })
  q.lt = jest.fn((col: string) => {
    if (col === 'expires_at') state.expiresBefore = true
    return q
  })
  q.is = jest.fn((col: string, val: unknown) => {
    if (col === 'consumed_at' && val === null) state.consumedNull = true
    return q
  })
  q.gte = jest.fn((col: string) => {
    if (col === 'expires_at') state.expiresAfter = true
    return q
  })
  q.then = (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) => {
    let result = results.total
    if (state.consumedNull && state.expiresAfter) result = results.outstanding
    else if (state.consumedNotNull) result = results.consumed
    else if (state.expiresBefore) result = results.expired
    return Promise.resolve(result).then(resolve, reject)
  }
  return q
}

function buildSupabase(opts?: {
  noncesTotal?: QueryResult
  noncesConsumed?: QueryResult
  noncesExpired?: QueryResult
  noncesOutstanding?: QueryResult
  totals?: QueryResult
  accepted?: QueryResult
}) {
  const results = {
    nonces: {
      total: opts?.noncesTotal ?? { count: 10, error: null },
      consumed: opts?.noncesConsumed ?? { count: 4, error: null },
      expired: opts?.noncesExpired ?? { count: 3, error: null },
      outstanding: opts?.noncesOutstanding ?? { count: 3, error: null },
    },
    totals: opts?.totals ?? { data: [{ total_pallets: 60 }, { total_pallets: 40 }], error: null },
    accepted: opts?.accepted ?? { count: 14, error: null },
  }
  const from = jest.fn((table: string) => {
    if (table === 'bootstrap_nonces') return noncesQuery(results.nonces)
    if (table === 'company_totals') return query(results.totals)
    if (table === 'vote_sessions') return query(results.accepted)
    throw new Error('unexpected table: ' + table)
  })
  return { from }
}

function getRequest(): NextRequest {
  return { nextUrl: { origin: 'http://localhost:3000' } } as unknown as NextRequest
}

function jsonFetch(contentType: string | null, status = 200) {
  return jest.fn(async () => ({
    status,
    headers: { get: () => contentType },
  })) as unknown as typeof fetch
}

describe('GET /api/admin/security/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN_CTX)
    mockToAdminError.mockReturnValue(500)
    mockSessionIdentityMode.mockReturnValue('dual')
    mockCreateAdminClient.mockReturnValue(buildSupabase())
    global.fetch = jsonFetch('application/json')
  })

  it('ritorna 200 con la shape attesa e no-store', async () => {
    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(data.identityMode).toBe('dual')
    expect(data.nonces).toEqual({
      total: 10,
      consumed: 4,
      expired: 3,
      outstanding: 3,
      suspiciousOutstanding: false,
    })
    expect(data.totalsDrift).toEqual({ drift: 2, aligned: false })
    expect(data.voteHealth).toEqual({ ok: true, kind: 'json' })
  })

  it('viewer è ammesso (requireAdmin, nessun requireRoleAdmin)', async () => {
    mockRequireAdmin.mockResolvedValue({ ...ADMIN_CTX, role: 'viewer' })

    const res = await GET(getRequest())

    expect(res.status).toBe(200)
    expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
  })

  it('nega accesso non autenticato', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('unauthorized'))
    mockToAdminError.mockReturnValue(401)

    const res = await GET(getRequest())

    expect(res.status).toBe(401)
  })

  it('classifica html come salute ko', async () => {
    global.fetch = jsonFetch('text/html', 503)

    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.voteHealth).toEqual({ ok: false, kind: 'html' })
  })

  it('json 500 → salute ko nonostante il content-type', async () => {
    global.fetch = jsonFetch('application/json', 500)

    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.voteHealth).toEqual({ ok: false, kind: 'json' })
  })

  it('fetch in errore → voteHealth other, nessun 500', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.voteHealth).toEqual({ ok: false, kind: 'other' })
  })

  it('errore DB su nonces → sezione degradata, resto intatto', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({ noncesTotal: { count: null, error: { message: 'boom' } } }),
    )

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(typeof data.nonces.error).toBe('string')
    expect(data.nonces.total).toBeUndefined()
    expect(data.totalsDrift).toEqual({ drift: 2, aligned: false })
    expect(data.voteHealth).toEqual({ ok: true, kind: 'json' })
  })

  it('errore DB su totals → sezione degradata, resto intatto', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({ totals: { data: null, error: { message: 'boom' } } }),
    )

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(typeof data.totalsDrift.error).toBe('string')
    expect(data.nonces.total).toBe(10)
    expect(data.voteHealth).toEqual({ ok: true, kind: 'json' })
  })

  it('outstanding preciso: un nonce consumato e scaduto non riduce due volte', async () => {
    const supabase = buildSupabase({
      noncesTotal: { count: 10, error: null },
      noncesConsumed: { count: 5, error: null },
      noncesExpired: { count: 4, error: null },
      noncesOutstanding: { count: 2, error: null },
    })
    mockCreateAdminClient.mockReturnValue(supabase)

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.nonces).toMatchObject({
      total: 10,
      consumed: 5,
      expired: 4,
      outstanding: 2,
    })

    // Il conteggio outstanding usa i filtri precisi, non total-consumed-expired (=1).
    const queries = supabase.from.mock.results.map((r) => r.value as Record<string, jest.Mock>)
    const outstandingQuery = queries.find((q) =>
      q.is.mock.calls.some(([col, val]) => col === 'consumed_at' && val === null),
    )
    expect(outstandingQuery).toBeDefined()
    expect(outstandingQuery!.gte).toHaveBeenCalledWith('expires_at', expect.any(String))

    // `summarizeNonces` riceve l'outstanding preciso.
    expect(mockSummarizeNonces).toHaveBeenCalledWith({
      total: 10,
      consumed: 5,
      expired: 4,
      outstanding: 2,
    })
  })

  it('totals allineati quando i valori coincidono', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase({
        totals: { data: [{ total_pallets: 98 }], error: null },
        accepted: { count: 14, error: null },
      }),
    )

    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.totalsDrift).toEqual({ drift: 0, aligned: true })
  })

  it('esegue il probe POST su /api/vota con credentials omit', async () => {
    await GET(getRequest())

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/vota',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: '{}',
      }),
    )
  })
})
