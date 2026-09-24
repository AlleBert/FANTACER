/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/vota/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/supabase/batch', () => ({ getActiveBatch: jest.fn() }))
jest.mock('@/lib/supabase/vote-api', () => ({ submitVote: jest.fn() }))
jest.mock('@/lib/site-flags', () => ({ getAntibotEnabled: jest.fn(), getFairEndState: jest.fn() }))
jest.mock('@/lib/turnstile', () => ({ verifyTurnstile: jest.fn() }))
jest.mock('@/lib/vote-rate-limit', () => ({
  evaluateVoteRateLimit: jest.fn(async () => ({
    mode: 'observe',
    allowed: true,
    rawAllowed: true,
    retryAfterSec: 600,
    scopes: [],
  })),
}))
jest.mock('@/lib/vote-dev-bypass', () => ({
  isVoteLimitBypassed: jest.fn(() => false),
  resolveVoteFingerprint: (key: string) => key,
}))
jest.mock('@/lib/session-identity-server', () => ({
  sessionIdentityMode: jest.fn(() => 'off'),
  getActiveEvent: jest.fn(),
  resolveOrCreatePrincipal: jest.fn(),
  resolveSessionPrincipal: jest.fn(),
  linkVoteToPrincipal: jest.fn(),
  resolveVoteIdentity: jest.fn(),
  resolveVoteIdentityResult: jest.fn(),
  touchSession: jest.fn(),
}))
jest.mock('@/lib/locale', () => ({
  LOCALE_COOKIE: 'fantacer_locale',
  resolveLocale: () => 'it',
}))
jest.mock('@/i18n', () => ({ translate: (_locale: string, key: string) => key }))

import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveBatch } from '@/lib/supabase/batch'
import { submitVote } from '@/lib/supabase/vote-api'
import { getAntibotEnabled, getFairEndState } from '@/lib/site-flags'
import { verifyTurnstile } from '@/lib/turnstile'
import { evaluateVoteRateLimit } from '@/lib/vote-rate-limit'
import {
  sessionIdentityMode,
  getActiveEvent,
  resolveOrCreatePrincipal,
  resolveVoteIdentity,
  resolveVoteIdentityResult,
  linkVoteToPrincipal,
  touchSession,
} from '@/lib/session-identity-server'
import { parseKeyring, generateCsrfToken, hashCsrfToken } from '@/lib/session-identity'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockGetActiveBatch = getActiveBatch as jest.Mock
const mockSubmitVote = submitVote as jest.Mock
const mockGetAntibotEnabled = getAntibotEnabled as jest.Mock
const mockGetFairEndState = getFairEndState as jest.Mock
const mockVerifyTurnstile = verifyTurnstile as jest.Mock
const mockEvaluateVoteRateLimit = evaluateVoteRateLimit as jest.Mock
const mockMode = sessionIdentityMode as jest.Mock
const mockGetActiveEvent = getActiveEvent as jest.Mock
const mockResolveOrCreatePrincipal = resolveOrCreatePrincipal as jest.Mock
const mockResolveVoteIdentity = resolveVoteIdentity as jest.Mock
const mockResolveVoteIdentityResult = resolveVoteIdentityResult as jest.Mock
const mockLinkVoteToPrincipal = linkVoteToPrincipal as jest.Mock
const mockTouchSession = touchSession as jest.Mock

const okResult = (session: unknown) => ({ status: 'ok', session })
const noneResult = () => ({ status: 'none' })
const errorResult = () => ({ status: 'error' })

const UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LEGACY_FP = 'b9e2ed7ea02c48153440fe332da039e8'

const COMPANY_IDS = ['c1', 'c2', 'c3']

function buildAdmin() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'event_principals') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return {
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({
            data: COMPANY_IDS.map((id) => ({ id, batch: 'TEST' })),
            error: null,
          }),
        })),
      }
    }),
  }
}

interface ReqOptions {
  cookie?: string
  headers?: Record<string, string>
}

function makeRequest(body: unknown, opts: ReqOptions = {}): NextRequest {
  const headerMap: Record<string, string> = {
    'user-agent': 'jest-agent',
    'x-forwarded-for': '10.0.0.1',
    ...opts.headers,
  }
  return {
    json: async () => body,
    cookies: {
      get: (name: string) =>
        opts.cookie && name === 'fantacer_voter_id' ? { name, value: opts.cookie } : undefined,
    },
    headers: { get: (name: string) => headerMap[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  // C08: `voterId` non fa più parte del contratto. I test che vogliono
  // verificare che venga ignorato lo aggiungono esplicitamente.
  return {
    company1Id: 'c1',
    company2Id: 'c2',
    company3Id: 'c3',
    turnstile_token: 'tok',
    botd: '',
    visitorId: LEGACY_FP,
    ...overrides,
  }
}

describe('POST /api/vota', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.TURNSTILE_SECRET_KEY
    mockCreateAdminClient.mockReturnValue(buildAdmin())
    mockGetActiveBatch.mockResolvedValue('TEST')
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockGetFairEndState.mockResolvedValue({ enabled: false })
    mockSubmitVote.mockResolvedValue({ success: true })
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
    mockGetActiveEvent.mockResolvedValue(null)
    mockResolveOrCreatePrincipal.mockResolvedValue(null)
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    mockLinkVoteToPrincipal.mockResolvedValue(undefined)
    process.env.SIGNAL_HMAC_KEY = Buffer.alloc(32, 11).toString('base64')
    process.env.SIGNAL_HMAC_KEY_ID = 's1'
  })

  afterEach(() => {
    delete process.env.SIGNAL_HMAC_KEY
    delete process.env.SIGNAL_HMAC_KEY_ID
  })

  it('423 quando l\'anti-bot è attivo (voto sospeso server-side)', async () => {
    mockGetAntibotEnabled.mockResolvedValue(true)
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(423)
    expect(await res.json()).toEqual({ error: 'voteError.antibot' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('423 quando FINE FIERA è attivo', async () => {
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockGetFairEndState.mockResolvedValue({ enabled: true })
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(423)
    expect(await res.json()).toEqual({ error: 'voteError.fairEnded' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 senza identità (né cookie né payload)', async () => {
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingVoterId' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 con solo visitorId legacy (non UUID)', async () => {
    const res = await POST(makeRequest(validBody({ visitorId: LEGACY_FP })))
    expect(res.status).toBe(400)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('registra il voto con chiave versionata v1:<uuid> dal cookie first-party', async () => {
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`fantacer_voter_id=${UUID}`)
  })

  it('ignora il voterId nel body: vince il cookie first-party', async () => {
    const res = await POST(makeRequest(validBody({ voterId: OTHER_UUID }), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
  })

  it('ignora il voterId nel body: senza cookie → 400, nessun voto', async () => {
    const res = await POST(makeRequest(validBody({ voterId: UUID })))

    expect(res.status).toBe(400)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
    expect(mockResolveOrCreatePrincipal).not.toHaveBeenCalled()
  })

  it('stesso visitorId con UUID diversi: entrambi votano (collisione risolta)', async () => {
    const first = await POST(makeRequest(validBody(), { cookie: UUID }))
    const second = await POST(makeRequest(validBody(), { cookie: OTHER_UUID }))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const keys = mockSubmitVote.mock.calls.map((c) => c[0].fingerprint)
    expect(new Set(keys).size).toBe(2)
    expect(keys).toContain(`v1:${UUID}`)
    expect(keys).toContain(`v1:${OTHER_UUID}`)
  })

  it('409 quando la RPC risponde "Hai già votato oggi"', async () => {
    mockSubmitVote.mockResolvedValue({ success: false, error: 'Hai già votato oggi' })
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'voteError.alreadyVoted' })
  })

  it('400 senza campi azienda (ma con identità valida)', async () => {
    const res = await POST(makeRequest(validBody({ company1Id: undefined }), { cookie: UUID }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingFields' })
  })

  it('400 se una azienda è bloccata dall Admin (nessuna scrittura DB)', async () => {
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: 'c1', batch: 'TEST', blocked: false },
              { id: 'c2', batch: 'TEST', blocked: true },
              { id: 'c3', batch: 'TEST', blocked: false },
            ],
            error: null,
          }),
        })),
      })),
    })

    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.companyBlocked' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 senza turnstile_token: nessuna scrittura DB', async () => {
    const res = await POST(makeRequest(validBody({ turnstile_token: undefined }), { cookie: UUID }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingSecurity' })
    expect(mockVerifyTurnstile).not.toHaveBeenCalled()
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 se Turnstile fallisce: risposta neutra e nessuna scrittura DB', async () => {
    mockVerifyTurnstile.mockResolvedValue({ ok: false, reason: 'hostname_not_allowed' })
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.securityFailed' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('P0-3 observe: oltre soglia non blocca (nessuna modifica di comportamento)', async () => {
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockEvaluateVoteRateLimit.mockResolvedValueOnce({
      mode: 'observe',
      allowed: true,
      rawAllowed: false,
      retryAfterSec: 600,
      scopes: [],
    })
    mockCreateAdminClient.mockReturnValue(buildAdmin())
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
    mockSubmitVote.mockResolvedValue({ success: true })

    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('P0-3 enforce: oltre soglia → 429 con Retry-After', async () => {
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockEvaluateVoteRateLimit.mockResolvedValueOnce({
      mode: 'enforce',
      allowed: false,
      rawAllowed: false,
      retryAfterSec: 120,
      scopes: [],
    })

    const res = await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect(await res.json()).toEqual({ error: 'voteError.rateLimited' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('emette il marker vote_request_end senza dati identificativi', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockCreateAdminClient.mockReturnValue(buildAdmin())
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
    mockSubmitVote.mockResolvedValue({ success: true })

    await POST(makeRequest(validBody(), { cookie: UUID }))

    const lines = logSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.includes('vote_request_end'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain(UUID)
    expect(lines[0]).not.toContain(LEGACY_FP)
    expect(lines[0]).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/)
    logSpy.mockRestore()
  })
})

describe('POST /api/vota — CSRF sessione (C05)', () => {
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
    process.env.SIGNAL_HMAC_KEY = Buffer.alloc(32, 11).toString('base64')
    process.env.SIGNAL_HMAC_KEY_ID = 's1'
    mockCreateAdminClient.mockReturnValue(buildAdmin())
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockGetFairEndState.mockResolvedValue({ enabled: false })
    mockSubmitVote.mockResolvedValue({ success: true })
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
    mockMode.mockReturnValue('dual')
    mockGetActiveEvent.mockResolvedValue({ id: 'ev-1', batch: 'TEST' })
  })

  afterEach(() => {
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    delete process.env.SIGNAL_HMAC_KEY
    delete process.env.SIGNAL_HMAC_KEY_ID
    mockMode.mockReturnValue('off')
    mockResolveVoteIdentity.mockReset()
    mockResolveVoteIdentityResult.mockReset()
    mockTouchSession.mockReset()
  })

  it('sessione risolta senza X-CSRF-Token → 403, nessun voto', async () => {
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(generateCsrfToken(), keyring))))
    const res = await POST(
      makeRequest(validBody(), { headers: { origin: ORIGIN, host: HOST } }),
    )
    expect(res.status).toBe(403)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('X-CSRF-Token errato → 403', async () => {
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(generateCsrfToken(), keyring))))
    const res = await POST(
      makeRequest(validBody(), {
        headers: { origin: ORIGIN, host: HOST, 'x-csrf-token': 'wrong' },
      }),
    )
    expect(res.status).toBe(403)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('Origin assente → 403 fail-closed', async () => {
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      makeRequest(validBody(), { headers: { host: HOST, 'x-csrf-token': csrf } }),
    )
    expect(res.status).toBe(403)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('Origin cross-site → 403', async () => {
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      makeRequest(validBody(), {
        headers: { origin: 'https://attacker.test', host: HOST, 'x-csrf-token': csrf },
      }),
    )
    expect(res.status).toBe(403)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('X-CSRF-Token valido e Origin same-origin → 200, vota e rinnova idle', async () => {
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      makeRequest(validBody(), {
        headers: { origin: ORIGIN, host: HOST, 'x-csrf-token': csrf },
      }),
    )
    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalled()
    expect(mockTouchSession).toHaveBeenCalledTimes(1)
    expect(mockTouchSession).toHaveBeenCalledWith(expect.anything(), 'sess-1')
  })

  it('modo off: nessuna sessione e nessuna verifica CSRF (legacy)', async () => {
    mockMode.mockReturnValue('off')
    const res = await POST(makeRequest(validBody(), { cookie: UUID, headers: { host: HOST } }))
    expect(res.status).toBe(200)
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
    expect(mockResolveVoteIdentityResult).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })
})

describe('POST /api/vota — C08 semantica dei mode', () => {
  const B64_KEY = Buffer.alloc(32, 7).toString('base64')
  const keyring = parseKeyring(`k1:${B64_KEY}`, 'k1')!
  const SPINNER_KEY = Buffer.alloc(32, 11).toString('base64')
  const ORIGIN = 'https://fantacer.test'
  const HOST = 'fantacer.test'

  const session = (csrfHash: string | null) => ({
    principalId: 'prim-1',
    sessionId: 'sess-1',
    csrfHash,
    expiresAt: '2099-01-01T00:00:00.000Z',
    revokedAt: null,
  })

  function setSessionKeyring() {
    process.env.SESSION_HMAC_KEYS = `k1:${B64_KEY}`
    process.env.SESSION_HMAC_ACTIVE = 'k1'
  }

  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // I percorsi di errore (shadow non-bloccante, segnali assenti) loggano un
    // warning: lo silenziamo per mantenere l'output dei test pulito.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    delete process.env.TURNSTILE_SECRET_KEY
    setSessionKeyring()
    mockCreateAdminClient.mockReturnValue(buildAdmin())
    mockGetActiveBatch.mockResolvedValue('TEST')
    mockGetAntibotEnabled.mockResolvedValue(false)
    mockGetFairEndState.mockResolvedValue({ enabled: false })
    mockSubmitVote.mockResolvedValue({ success: true })
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
    mockGetActiveEvent.mockResolvedValue({ id: 'ev-1', batch: 'TEST' })
    mockResolveOrCreatePrincipal.mockResolvedValue('prim-shadow')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    mockLinkVoteToPrincipal.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    delete process.env.SIGNAL_HMAC_KEY
    delete process.env.SIGNAL_HMAC_KEY_ID
    mockMode.mockReturnValue('off')
    warnSpy.mockRestore()
  })

  it('off: legacy-only, nessuna chiamata al percorso principal', async () => {
    mockMode.mockReturnValue('off')
    const res = await POST(makeRequest(validBody({ voterId: OTHER_UUID }), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
    expect(mockResolveVoteIdentity).not.toHaveBeenCalled()
    expect(mockGetActiveEvent).not.toHaveBeenCalled()
    expect(mockResolveOrCreatePrincipal).not.toHaveBeenCalled()
    expect(mockLinkVoteToPrincipal).not.toHaveBeenCalled()
  })

  it('shadow: il voto legacy riesce anche se la risoluzione sessione lancia (non-bloccante)', async () => {
    mockMode.mockReturnValue('shadow')
    mockResolveVoteIdentity.mockRejectedValue(new Error('db down'))
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
  })

  it('shadow: il voto legacy riesce anche se resolveOrCreatePrincipal lancia (non-bloccante)', async () => {
    mockMode.mockReturnValue('shadow')
    mockResolveVoteIdentity.mockResolvedValue(null)
    mockResolveOrCreatePrincipal.mockRejectedValue(new Error('insert failed'))
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalled()
  })

  it('shadow: il voto legacy riesce anche se signalsFingerprint lancia (HMAC assente)', async () => {
    mockMode.mockReturnValue('shadow')
    // SIGNAL_HMAC_KEY assente: signalsFingerprint solleva SignalsConfigError.
    delete process.env.SIGNAL_HMAC_KEY
    delete process.env.SIGNAL_HMAC_KEY_ID
    mockResolveVoteIdentity.mockResolvedValue(null)
    mockResolveOrCreatePrincipal.mockResolvedValue('prim-shadow')
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalled()
  })

  it('shadow: dual-write del principal best-effort (link dopo il voto)', async () => {
    mockMode.mockReturnValue('shadow')
    mockResolveVoteIdentity.mockResolvedValue(null)
    mockResolveOrCreatePrincipal.mockResolvedValue('prim-shadow')
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockLinkVoteToPrincipal).toHaveBeenCalledWith(
      expect.anything(),
      `v1:${UUID}`,
      expect.any(String),
      'ev-1',
      'prim-shadow',
    )
  })

  it('shadow: senza cookie → 400 (identità solo dal cookie first-party)', async () => {
    mockMode.mockReturnValue('shadow')
    const res = await POST(makeRequest(validBody({ voterId: UUID })))
    expect(res.status).toBe(400)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('dual: sessione valida → usa il principal della sessione', async () => {
    mockMode.mockReturnValue('dual')
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      makeRequest(validBody(), {
        headers: { origin: ORIGIN, host: HOST, 'x-csrf-token': csrf },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: 'principal:prim-1' }),
    )
    expect(mockTouchSession).toHaveBeenCalled()
  })

  it('dual: senza sessione ma con cookie legacy → fallback cookie, nessun CSRF', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
    expect(mockTouchSession).not.toHaveBeenCalled()
    expect(mockResolveOrCreatePrincipal).toHaveBeenCalled()
  })

  it('dual: nessuna sessione e nessun cookie → 400, nessun voto', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(makeRequest(validBody({ voterId: UUID })))
    expect(res.status).toBe(400)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('dual: errore di risoluzione primaria (throw) → 503 fail-closed, nessun voto', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockRejectedValue(new Error('db down'))
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('dual: errore DB nel lookup ({ error }, non throw) → 503, nessun fallback, nessun voto', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(errorResult())
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
    // L'errore NON deve degradare nel fallback legacy (cookie presente).
    expect(mockResolveOrCreatePrincipal).not.toHaveBeenCalled()
    expect(mockTouchSession).not.toHaveBeenCalled()
  })

  it('dual: fallback, throw di resolveOrCreatePrincipal → 503 (non 500), nessun voto', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    mockResolveOrCreatePrincipal.mockRejectedValue(new Error('insert failed'))
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('dual: keyring assente → 503 fail-closed, nessun voto', async () => {
    mockMode.mockReturnValue('dual')
    delete process.env.SESSION_HMAC_KEYS
    delete process.env.SESSION_HMAC_ACTIVE
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('dual: errori shadow/segnali non bloccano il voto legacy in fallback', async () => {
    mockMode.mockReturnValue('dual')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    // SIGNAL_HMAC_KEY assente: signalsFingerprint solleva, ma non deve bloccare.
    delete process.env.SIGNAL_HMAC_KEY
    delete process.env.SIGNAL_HMAC_KEY_ID
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalled()
  })

  it('session: senza sessione → 503 fail-closed, nessun voto', async () => {
    mockMode.mockReturnValue('session')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('session: nessun fallback legacy anche con cookie valido', async () => {
    mockMode.mockReturnValue('session')
    mockResolveVoteIdentityResult.mockResolvedValue(noneResult())
    await POST(makeRequest(validBody(), { cookie: UUID }))
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('session: errore DB nel lookup → 503, nessun voto', async () => {
    mockMode.mockReturnValue('session')
    mockResolveVoteIdentityResult.mockResolvedValue(errorResult())
    const res = await POST(makeRequest(validBody(), { cookie: UUID }))

    expect(res.status).toBe(503)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('session: sessione valida + CSRF → vota', async () => {
    mockMode.mockReturnValue('session')
    process.env.SIGNAL_HMAC_KEY = SPINNER_KEY
    process.env.SIGNAL_HMAC_KEY_ID = 's1'
    const csrf = generateCsrfToken()
    mockResolveVoteIdentityResult.mockResolvedValue(okResult(session(hashCsrfToken(csrf, keyring))))
    const res = await POST(
      makeRequest(validBody({ voterId: OTHER_UUID }), {
        headers: { origin: ORIGIN, host: HOST, 'x-csrf-token': csrf },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalled()
  })

  it('la telemetria riporta identityMode senza dati identificativi', async () => {
    mockMode.mockReturnValue('shadow')
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    mockResolveVoteIdentity.mockResolvedValue(null)
    mockResolveOrCreatePrincipal.mockResolvedValue('prim-shadow')

    await POST(makeRequest(validBody(), { cookie: UUID }))

    const line = logSpy.mock.calls
      .map((c) => String(c[0]))
      .find((l) => l.includes('vote_request_end'))
    expect(line).toBeDefined()
    const parsed = JSON.parse(line as string)
    expect(parsed.identityMode).toBe('shadow')
    expect(line).not.toContain(UUID)
    logSpy.mockRestore()
  })
})
