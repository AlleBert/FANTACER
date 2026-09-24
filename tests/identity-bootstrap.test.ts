/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/turnstile', () => ({ verifyTurnstile: jest.fn() }))
jest.mock('@/lib/bootstrap-rate-limit', () => ({
  evaluateBootstrapRateLimit: jest.fn(async () => ({
    mode: 'observe',
    allowed: true,
    rawAllowed: true,
    retryAfterSec: 600,
    key: null,
  })),
}))
jest.mock('@/lib/bootstrap-nonce', () => ({
  createBootstrapNonce: jest.fn(),
  consumeBootstrapNonce: jest.fn(),
  verifyBootstrapCData: jest.fn(),
  BOOTSTRAP_CDATA_PREFIX: 'bootstrap:',
}))
jest.mock('@/lib/session-identity', () => ({
  SESSION_COOKIE: 'fantacer_session',
  keyringFromEnv: jest.fn(),
  sessionCookieOptions: jest.fn(() => ({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 100,
  })),
}))
jest.mock('@/lib/session-identity-server', () => ({
  sessionIdentityMode: jest.fn(),
  getActiveEvent: jest.fn(),
  resolveOrCreatePrincipal: jest.fn(),
  createSession: jest.fn(),
}))
jest.mock('@/lib/vote-identity-server', () => ({ resolveVoterKey: jest.fn() }))
jest.mock('@/lib/vote-dev-bypass', () => ({ resolveVoteFingerprint: (k: string) => k }))
jest.mock('@/lib/request-ip', () => ({
  getTrustedClientIp: jest.fn(),
  hmacIp: jest.fn(),
}))
jest.mock('@/lib/locale', () => ({
  LOCALE_COOKIE: 'fantacer_locale',
  resolveLocale: () => 'it',
}))
jest.mock('@/i18n', () => ({ translate: (_locale: string, key: string) => key }))

import { POST } from '../src/app/api/identity/bootstrap/route'
import { GET } from '../src/app/api/identity/bootstrap/nonce/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstile } from '@/lib/turnstile'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import {
  createBootstrapNonce,
  consumeBootstrapNonce,
  verifyBootstrapCData,
} from '@/lib/bootstrap-nonce'
import { keyringFromEnv } from '@/lib/session-identity'
import {
  sessionIdentityMode,
  getActiveEvent,
  resolveOrCreatePrincipal,
  createSession,
} from '@/lib/session-identity-server'
import { resolveVoterKey } from '@/lib/vote-identity-server'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'

const mockVerifyTurnstile = verifyTurnstile as jest.Mock
const mockCreateAdminClient = createAdminClient as jest.Mock
const mockEvaluate = evaluateBootstrapRateLimit as jest.Mock
const mockCreateNonce = createBootstrapNonce as jest.Mock
const mockConsumeNonce = consumeBootstrapNonce as jest.Mock
const mockVerifyCData = verifyBootstrapCData as jest.Mock
const mockKeyring = keyringFromEnv as jest.Mock
const mockMode = sessionIdentityMode as jest.Mock
const mockGetActiveEvent = getActiveEvent as jest.Mock
const mockResolvePrincipal = resolveOrCreatePrincipal as jest.Mock
const mockCreateSession = createSession as jest.Mock
const mockResolveVoterKey = resolveVoterKey as jest.Mock
const mockTrustedIp = getTrustedClientIp as jest.Mock
const mockHmacIp = hmacIp as jest.Mock

const NONCE = 'abcdefghijklmnopqrstuvwxyz0123456789'
const CDATA = `bootstrap:${NONCE}`

function makeRequest(body: unknown): NextRequest {
  const headerMap: Record<string, string> = {
    'user-agent': 'jest-agent',
    'accept-language': 'it',
    'cf-connecting-ip': '1.2.3.4',
    'cf-ray': 'ray-1',
  }
  return {
    json: async () => body,
    cookies: { get: () => undefined },
    headers: { get: (name: string) => headerMap[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { turnstile_token: 'tok', cData: CDATA, ...overrides }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreateAdminClient.mockReturnValue({})
  mockTrustedIp.mockReturnValue({
    ip: '1.2.3.4',
    detectedIp: '1.2.3.4',
    source: 'cf-connecting-ip',
    confidence: 'medium',
  })
  mockHmacIp.mockReturnValue('k1.hash')
  mockEvaluate.mockResolvedValue({
    mode: 'observe',
    allowed: true,
    rawAllowed: true,
    retryAfterSec: 600,
    key: 'bootstrap:ip:k1.hash',
  })
  mockVerifyTurnstile.mockResolvedValue({ ok: true })
  mockVerifyCData.mockReturnValue(NONCE)
  mockConsumeNonce.mockResolvedValue(true)
  mockMode.mockReturnValue('dual')
  mockKeyring.mockReturnValue({ active: 'k1', keys: new Map() })
  mockGetActiveEvent.mockResolvedValue({ id: 'ev-1', batch: 'TEST' })
  mockResolvePrincipal.mockResolvedValue('prim-1')
  mockCreateSession.mockResolvedValue({
    cookieValue: 'k1.session-token',
    principalId: 'prim-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    csrfToken: 'csrf-token-123',
  })
  mockResolveVoterKey.mockReturnValue({ key: 'v1:uuid', voterId: 'uuid' })
  mockCreateNonce.mockResolvedValue({ nonce: NONCE, cData: CDATA })
})

describe('POST /api/identity/bootstrap', () => {
  it('missing cData → 400, nessuna verifica/sessione', async () => {
    const res = await POST(makeRequest(validBody({ cData: undefined })))
    expect(res.status).toBe(400)
    expect(mockVerifyTurnstile).not.toHaveBeenCalled()
    expect(mockConsumeNonce).not.toHaveBeenCalled()
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('missing turnstile → 400 senza consumare il nonce', async () => {
    const res = await POST(makeRequest(validBody({ turnstile_token: undefined })))
    expect(res.status).toBe(400)
    expect(mockConsumeNonce).not.toHaveBeenCalled()
  })

  it('cData malformato → 400', async () => {
    mockVerifyCData.mockReturnValue(null)
    const res = await POST(makeRequest(validBody({ cData: 'not-a-bootstrap-cdata' })))
    expect(res.status).toBe(400)
    expect(mockConsumeNonce).not.toHaveBeenCalled()
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('nonce sconosciuto/riuso → 403, nessuna sessione', async () => {
    mockConsumeNonce.mockResolvedValue(false)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(403)
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('nonce scaduto (consume false) → 403', async () => {
    mockConsumeNonce.mockResolvedValue(false)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(403)
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('Turnstile con action bootstrap e cData', async () => {
    await POST(makeRequest(validBody()))
    expect(mockVerifyTurnstile).toHaveBeenCalledWith('tok', {
      action: 'bootstrap',
      cData: CDATA,
    })
  })

  it('action mismatch Turnstile → 400', async () => {
    mockVerifyTurnstile.mockResolvedValue({ ok: false, reason: 'action_mismatch' })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(400)
    expect(mockConsumeNonce).not.toHaveBeenCalled()
  })

  it('cData mismatch Turnstile → 400', async () => {
    mockVerifyTurnstile.mockResolvedValue({ ok: false, reason: 'cdata_mismatch' })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(400)
    expect(mockConsumeNonce).not.toHaveBeenCalled()
  })

  it('rate-limit observe oltre soglia → prosegue', async () => {
    mockEvaluate.mockResolvedValue({
      mode: 'observe',
      allowed: true,
      rawAllowed: false,
      retryAfterSec: 600,
      key: 'bootstrap:ip:k1.hash',
    })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(200)
    expect(mockCreateSession).toHaveBeenCalled()
  })

  it('rate-limit enforce oltre soglia → 429 + Retry-After, nessuna verifica', async () => {
    mockEvaluate.mockResolvedValue({
      mode: 'enforce',
      allowed: false,
      rawAllowed: false,
      retryAfterSec: 120,
      key: 'bootstrap:ip:k1.hash',
    })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect(mockVerifyTurnstile).not.toHaveBeenCalled()
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('il nonce è consumato prima della creazione sessione', async () => {
    await POST(makeRequest(validBody()))
    const consumeOrder = mockConsumeNonce.mock.invocationCallOrder[0]
    const sessionOrder = mockCreateSession.mock.invocationCallOrder[0]
    expect(consumeOrder).toBeLessThan(sessionOrder)
  })

  it('happy path → 200, csrfToken e cookie di sessione', async () => {
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, csrfToken: 'csrf-token-123' })
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('fantacer_session=k1.session-token')
    expect(mockConsumeNonce).toHaveBeenCalledWith(expect.anything(), NONCE)
    expect(mockCreateSession).toHaveBeenCalled()
  })

  it('config keyring assente → 503, nessuna sessione', async () => {
    mockKeyring.mockReturnValue(null)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(503)
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('HMAC assente con IP trusted → 503 (fail-closed)', async () => {
    mockHmacIp.mockReturnValue(null)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(503)
    expect(mockVerifyTurnstile).not.toHaveBeenCalled()
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('modo identità off → 404', async () => {
    mockMode.mockReturnValue('off')
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(404)
    expect(mockEvaluate).not.toHaveBeenCalled()
  })
})

describe('GET /api/identity/bootstrap/nonce', () => {
  it('emette nonce + cData', async () => {
    const res = await GET(makeRequest(undefined))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ nonce: NONCE, cData: CDATA })
    expect(mockCreateNonce).toHaveBeenCalled()
  })

  it('rate-limit enforce oltre soglia → 429 + Retry-After, nessun nonce', async () => {
    mockEvaluate.mockResolvedValue({
      mode: 'enforce',
      allowed: false,
      rawAllowed: false,
      retryAfterSec: 90,
      key: 'bootstrap:ip:k1.hash',
    })
    const res = await GET(makeRequest(undefined))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('90')
    expect(mockCreateNonce).not.toHaveBeenCalled()
  })

  it('errore creazione nonce → 503', async () => {
    mockCreateNonce.mockResolvedValue(null)
    const res = await GET(makeRequest(undefined))
    expect(res.status).toBe(503)
  })

  it('modo identità off → 404', async () => {
    mockMode.mockReturnValue('off')
    const res = await GET(makeRequest(undefined))
    expect(res.status).toBe(404)
    expect(mockCreateNonce).not.toHaveBeenCalled()
  })
})
