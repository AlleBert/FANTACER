/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST, romeDayKey } from '../src/app/api/vota/status/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/vote-dev-bypass', () => ({
  isVoteLimitBypassed: jest.fn(() => false),
}))
jest.mock('@/lib/session-identity-server', () => ({
  sessionIdentityMode: jest.fn(() => 'off'),
  resolveVoteIdentity: jest.fn(),
  resolveVoteIdentityResult: jest.fn(),
  touchSession: jest.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import * as bypass from '@/lib/vote-dev-bypass'
import {
  sessionIdentityMode,
  resolveVoteIdentity,
  resolveVoteIdentityResult,
  touchSession,
} from '@/lib/session-identity-server'
import { parseKeyring, generateCsrfToken, hashCsrfToken } from '@/lib/session-identity'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockIsVoteLimitBypassed = bypass.isVoteLimitBypassed as jest.Mock
const mockMode = sessionIdentityMode as jest.Mock
const mockResolveVoteIdentity = resolveVoteIdentity as jest.Mock
const mockResolveVoteIdentityResult = resolveVoteIdentityResult as jest.Mock

const okResult = (session: unknown) => ({ status: 'ok', session })
const noneResult = () => ({ status: 'none' })
const errorResult = () => ({ status: 'error' })
const mockTouchSession = touchSession as jest.Mock

const UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const SESSION = {
  company1_id: 'c1',
  company2_id: 'c2',
  company3_id: 'c3',
  pallet1: 4,
  pallet2: 2,
  pallet3: 1,
}

const COMPANIES = [
  { id: 'c1', name: 'Alpha' },
  { id: 'c2', name: 'Beta' },
  { id: 'c3', name: 'Gamma' },
]

function buildSupabase(
  session: unknown,
  companies: unknown,
  opts?: { votesError?: unknown; companiesError?: unknown },
) {
  const eqCalls: Array<[string, unknown]> = []
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: opts?.votesError ? null : session, error: opts?.votesError ?? null })
  const limit = jest.fn().mockReturnValue({ maybeSingle })
  const order = jest.fn().mockReturnValue({ limit })
  const eqVoteDay = jest.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { order }
  })
  const eqFingerprint = jest.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq: eqVoteDay }
  })
  const selectVotes = jest.fn().mockReturnValue({ eq: eqFingerprint })
  const inFn = jest
    .fn()
    .mockResolvedValue({
      data: opts?.companiesError ? null : companies,
      error: opts?.companiesError ?? null,
    })
  const selectCompanies = jest.fn().mockReturnValue({ in: inFn })
  return {
    from: jest.fn((table: string) =>
      table === 'vote_sessions' ? { select: selectVotes } : { select: selectCompanies },
    ),
    _eqFingerprint: eqFingerprint,
    _eqVoteDay: eqVoteDay,
    _eqCalls: eqCalls,
  }
}

function postRequest(
  body: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
): NextRequest {
  const headerMap: Record<string, string> = { ...headers }
  return {
    json: async () => body,
    cookies: {
      get: (name: string) =>
        cookie && name === 'fantacer_voter_id' ? { name, value: cookie } : undefined,
    },
    headers: { get: (name: string) => headerMap[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

function malformedRequest(): NextRequest {
  return {
    json: async () => Promise.reject(new Error('bad json')),
    cookies: { get: () => undefined },
  } as unknown as NextRequest
}

describe('POST /api/vota/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsVoteLimitBypassed.mockReturnValue(false)
  })

  it('400 senza UUID valido (né cookie né payload)', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
  })

  it('400 con solo visitorId legacy (non UUID)', async () => {
    const res = await POST(postRequest({ visitorId: 'b9e2ed7ea02c48153440fe332da039e8' }))
    expect(res.status).toBe(400)
  })

  it('ignora il voterId del payload: senza cookie → 400', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(SESSION, COMPANIES))

    const res = await POST(postRequest({ voterId: UUID }))

    expect(res.status).toBe(400)
  })

  it('il cookie identità vince sul voterId del payload', async () => {
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)

    const res = await POST(postRequest({ voterId: OTHER_UUID }, UUID))

    expect(supabase._eqFingerprint).toHaveBeenCalledWith('fingerprint', `v1:${UUID}`)
    expect(await res.json()).toMatchObject({ voted: false, voterId: UUID })
  })

  it('imposta il cookie identità nella risposta', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(null, []))
    const res = await POST(postRequest({}, UUID))
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('fantacer_voter_id=')
    expect(setCookie).toContain(UUID)
  })

  it('bypass attivo: voted:false senza toccare il DB', async () => {
    mockIsVoteLimitBypassed.mockReturnValue(true)
    const supabase = buildSupabase(SESSION, COMPANIES)
    mockCreateAdminClient.mockReturnValue(supabase)

    const res = await POST(postRequest({}, UUID))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ voted: false, bypassed: true, voterId: UUID })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("voted:false se non c'è una sessione oggi", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(null, []))
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ voted: false, voterId: UUID })
  })

  it('voted:true con aziende e pallet reali', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(SESSION, COMPANIES))
    const res = await POST(postRequest({ voterId: UUID }, UUID))
    const data = await res.json()
    expect(data.voted).toBe(true)
    expect(data.companies).toEqual([
      { id: 'c1', name: 'Alpha', pallet: 4 },
      { id: 'c2', name: 'Beta', pallet: 2 },
      { id: 'c3', name: 'Gamma', pallet: 1 },
    ])
  })

  it('voted:true anche per un voto in quarantena: nessun filtro status (C11)', async () => {
    // La riga (mock) rappresenta un voto `quarantined`: /api/vota/status è una
    // read di dedup e NON deve filtrare per status (un votante in quarantena ha
    // comunque "già votato oggi"). Solo analytics/export/admin-listing filtrano.
    const supabase = buildSupabase(SESSION, COMPANIES)
    mockCreateAdminClient.mockReturnValue(supabase)
    const res = await POST(postRequest({}, UUID))
    const data = await res.json()
    expect(data.voted).toBe(true)
    expect(supabase._eqCalls.map(([col]) => col)).toEqual(['fingerprint', 'vote_day'])
  })

  it('500 se la query vote_sessions fallisce', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase(null, [], { votesError: { message: 'boom' } }),
    )
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(500)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('500 se la query companies fallisce', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase(SESSION, null, { companiesError: { message: 'boom' } }),
    )
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(500)
  })

  it('400 con body JSON malformato', async () => {
    const res = await POST(malformedRequest())
    expect(res.status).toBe(400)
  })

  it('success response ha Cache-Control no-store', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(SESSION, COMPANIES))
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('romeDayKey', () => {
  it('usa il fuso Europe/Rome', () => {
    expect(romeDayKey(new Date('2026-09-14T12:00:00Z'))).toBe('2026-09-14')
  })

  it('a mezzanotte UTC è già il giorno dopo a Roma (CEST)', () => {
    expect(romeDayKey(new Date('2026-09-13T23:30:00Z'))).toBe('2026-09-14')
  })
})

describe('POST /api/vota/status — CSRF sessione (C05)', () => {
  const B64_KEY = Buffer.alloc(32, 7).toString('base64')
  const keyring = parseKeyring(`k1:${B64_KEY}`, 'k1')!
  const ORIGIN = 'https://fantacer.test'
  const HOST = 'fantacer.test'

  const session = (csrfHash: string | null) => ({
    principalId: 'prim-1',
    sessionId: 'sess-1',
    csrfHash,
    expiresAt: '2099-01-01T00:00:00.000Z',
    revokedAt: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SESSION_HMAC_KEYS = `k1:${B64_KEY}`
    process.env.SESSION_HMAC_ACTIVE = 'k1'
    mockIsVoteLimitBypassed.mockReturnValue(false)
    mockMode.mockReturnValue('dual')
    mockCreateAdminClient.mockReturnValue(buildSupabase(null, []))
  })

  afterEach(() => {
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    mockMode.mockReturnValue('off')
    mockResolveVoteIdentity.mockReset()
    mockResolveVoteIdentityResult.mockReset()
    mockTouchSession.mockReset()
  })

  it('sessione risolta senza X-CSRF-Token → 200 (read non bloccata), nessun idle-touch', async () => {
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(generateCsrfToken(), keyring))))
    const res = await POST(
      postRequest({ voterId: UUID }, undefined, { origin: ORIGIN, host: HOST }),
    )
    expect(res.status).toBe(200)
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('X-CSRF-Token errato → 200 (read non bloccata), nessun idle-touch', async () => {
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(generateCsrfToken(), keyring))))
    const res = await POST(
      postRequest({ voterId: UUID }, undefined, {
        origin: ORIGIN,
        host: HOST,
        'x-csrf-token': 'wrong',
      }),
    )
    expect(res.status).toBe(200)
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('Origin assente → 200 (read non bloccata), nessun idle-touch', async () => {
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      postRequest({ voterId: UUID }, undefined, { host: HOST, 'x-csrf-token': csrf }),
    )
    expect(res.status).toBe(200)
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('X-CSRF-Token valido e Origin same-origin → 200, interroga il DB e rinnova idle', async () => {
    const csrf = generateCsrfToken()
    const supabase = buildSupabase(SESSION, COMPANIES)
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))

    const res = await POST(
      postRequest({ voterId: UUID }, undefined, {
        origin: ORIGIN,
        host: HOST,
        'x-csrf-token': csrf,
      }),
    )
    expect(res.status).toBe(200)
    expect(supabase._eqFingerprint).toHaveBeenCalled()
    expect(mockTouchSession).toHaveBeenCalledTimes(1)
    expect(mockTouchSession).toHaveBeenCalledWith(supabase, 'sess-1')
  })

  it('modo dual senza sessione: fallback legacy senza CSRF né touch', async () => {
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(postRequest({ voterId: OTHER_UUID }, UUID))
    expect(res.status).toBe(200)
    expect(mockResolveVoteIdentityResult).toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('modo off: nessuna risoluzione sessione né CSRF (legacy)', async () => {
    mockMode.mockReturnValue('off')
    const res = await POST(postRequest({ voterId: UUID }, UUID))
    expect(res.status).toBe(200)
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
    expect(mockResolveVoteIdentityResult).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })
})

describe('POST /api/vota/status — C08 semantica dei mode', () => {
  const B64_KEY = Buffer.alloc(32, 7).toString('base64')
  const keyring = parseKeyring(`k1:${B64_KEY}`, 'k1')!
  const ORIGIN = 'https://fantacer.test'
  const HOST = 'fantacer.test'

  const session = (csrfHash: string | null) => ({
    principalId: 'prim-1',
    sessionId: 'sess-1',
    csrfHash,
    expiresAt: '2099-01-01T00:00:00.000Z',
    revokedAt: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SESSION_HMAC_KEYS = `k1:${B64_KEY}`
    process.env.SESSION_HMAC_ACTIVE = 'k1'
    mockIsVoteLimitBypassed.mockReturnValue(false)
    mockCreateAdminClient.mockReturnValue(buildSupabase(null, []))
  })

  afterEach(() => {
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    mockMode.mockReturnValue('off')
    mockResolveVoteIdentity.mockReset()
    mockResolveVoteIdentityResult.mockReset()
    mockTouchSession.mockReset()
  })

  it('off: legge solo il cookie first-party, voterId ignorato', async () => {
    mockMode.mockReturnValue('off')
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)

    const res = await POST(postRequest({ voterId: OTHER_UUID }, UUID))

    expect(res.status).toBe(200)
    expect(supabase._eqFingerprint).toHaveBeenCalledWith('fingerprint', `v1:${UUID}`)
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
  })

  it('shadow: lettura legacy dal cookie, nessuna risoluzione sessione', async () => {
    mockMode.mockReturnValue('shadow')
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)

    const res = await POST(postRequest({ voterId: OTHER_UUID }, UUID))

    expect(res.status).toBe(200)
    expect(supabase._eqFingerprint).toHaveBeenCalledWith('fingerprint', `v1:${UUID}`)
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
  })

  it('shadow: senza cookie → 400 anche con voterId nel body', async () => {
    mockMode.mockReturnValue('shadow')
    const res = await POST(postRequest({ voterId: UUID }))
    expect(res.status).toBe(400)
  })

  it('dual: sessione valida → lookup per il principal di sessione', async () => {
    mockMode.mockReturnValue('dual')
    const supabase = buildSupabase(SESSION, COMPANIES)
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(null)))

    const res = await POST(postRequest({ voterId: OTHER_UUID }))

    expect(res.status).toBe(200)
    expect(mockResolveVoteIdentityResult).toHaveBeenCalled()
    expect(supabase._eqFingerprint).toHaveBeenCalled()
  })

  it('dual: senza sessione ma con cookie legacy → fallback cookie', async () => {
    mockMode.mockReturnValue('dual')
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())

    const res = await POST(postRequest({ voterId: OTHER_UUID }, UUID))

    expect(res.status).toBe(200)
    expect(supabase._eqFingerprint).toHaveBeenCalledWith('fingerprint', `v1:${UUID}`)
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('dual: senza sessione e senza cookie → 400', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(postRequest({ voterId: UUID }))
    expect(res.status).toBe(400)
  })

  it('dual: errore risoluzione sessione (throw) → 503 fail-closed', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockRejectedValue(new Error('db down'))
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(503)
  })

  it('dual: errore DB nel lookup ({ error }, non throw) → 503, nessun fallback legacy', async () => {
    mockMode.mockReturnValue('dual')
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(errorResult())
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(503)
    // L'errore NON deve degradare nel fallback legacy (cookie valido presente):
    // nessuna query su vote_sessions per il fingerprint legacy.
    expect(supabase._eqFingerprint).not.toHaveBeenCalled()
  })

  it('dual: keyring assente → 503 fail-closed', async () => {
    mockMode.mockReturnValue('dual')
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(503)
  })

  it('session: senza sessione → 503, nessun fallback legacy', async () => {
    mockMode.mockReturnValue('session')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(503)
  })

  it('session: errore DB nel lookup → 503, nessun fallback legacy', async () => {
    mockMode.mockReturnValue('session')
    const supabase = buildSupabase(null, [])
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(errorResult())
    const res = await POST(postRequest({}, UUID))
    expect(res.status).toBe(503)
    expect(supabase._eqFingerprint).not.toHaveBeenCalled()
  })

  it('session: sessione valida con CSRF → risponde e rinnova idle', async () => {
    mockMode.mockReturnValue('session')
    const csrf = generateCsrfToken()
    const supabase = buildSupabase(SESSION, COMPANIES)
    mockCreateAdminClient.mockReturnValue(supabase)
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))

    const res = await POST(
      postRequest({}, undefined, {
        origin: ORIGIN,
        host: HOST,
        'x-csrf-token': csrf,
      }),
    )

    expect(res.status).toBe(200)
    expect(mockTouchSession).toHaveBeenCalledTimes(1)
  })
})
