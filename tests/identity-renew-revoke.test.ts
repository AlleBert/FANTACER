/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/request-ip', () => ({
  getTrustedClientIp: jest.fn(),
  hmacIp: jest.fn(),
}))
jest.mock('@/lib/bootstrap-rate-limit', () => ({
  evaluateBootstrapRateLimit: jest.fn(),
}))
jest.mock('@/lib/session-identity', () => ({
  SESSION_COOKIE: 'fantacer_session',
  keyringFromEnv: jest.fn(),
  sessionCookieOptions: jest.fn((maxAge: number) => ({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })),
}))
jest.mock('@/lib/session-identity-server', () => ({
  resolveSession: jest.fn(),
  renewSession: jest.fn(),
  revokeSession: jest.fn(),
}))
jest.mock('@/lib/vote-csrf', () => ({ verifyCsrfForRequest: jest.fn() }))

import { POST as renew } from '../src/app/api/identity/renew/route'
import { POST as revoke } from '../src/app/api/identity/revoke/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import { keyringFromEnv, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session-identity'
import { resolveSession, renewSession, revokeSession } from '@/lib/session-identity-server'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockTrustedIp = getTrustedClientIp as jest.Mock
const mockHmacIp = hmacIp as jest.Mock
const mockEvaluate = evaluateBootstrapRateLimit as jest.Mock
const mockKeyring = keyringFromEnv as jest.Mock
const mockCookieOptions = sessionCookieOptions as jest.Mock
const mockResolveSession = resolveSession as jest.Mock
const mockRenewSession = renewSession as jest.Mock
const mockRevokeSession = revokeSession as jest.Mock
const mockVerifyCsrf = verifyCsrfForRequest as jest.Mock

const COOKIE = 'k1.old-token'

function makeRequest(cookie?: string): NextRequest {
  const headerMap: Record<string, string> = {
    host: 'fantacer.test',
    origin: 'https://fantacer.test',
    'x-csrf-token': 'csrf-token',
  }
  return {
    cookies: {
      get: (name: string) => (name === SESSION_COOKIE && cookie ? { value: cookie } : undefined),
    },
    headers: { get: (name: string) => headerMap[name.toLowerCase()] ?? null },
  } as unknown as NextRequest
}

function validSession(expiresAt: string) {
  return {
    principalId: 'prim-1',
    sessionId: 'sess-1',
    csrfHash: 'csrf-hash',
    expiresAt,
    revokedAt: null,
  }
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
  mockKeyring.mockReturnValue({ active: 'k1', keys: new Map() })
  mockResolveSession.mockResolvedValue(null)
  mockVerifyCsrf.mockReturnValue({ ok: true })
})

describe('POST /api/identity/renew', () => {
  it('senza cookie di sessione → 401, nessun rinnovo', async () => {
    const res = await renew(makeRequest(undefined))
    expect(res.status).toBe(401)
    expect(mockRenewSession).not.toHaveBeenCalled()
  })

  it('sessione non valida (cookie presente) → 401, nessun rinnovo', async () => {
    mockResolveSession.mockResolvedValue(null)
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(401)
    expect(mockRenewSession).not.toHaveBeenCalled()
  })

  it('CSRF mancante → 403, nessun rinnovo', async () => {
    mockResolveSession.mockResolvedValue(validSession(new Date(Date.now() + 3600_000).toISOString()))
    mockVerifyCsrf.mockReturnValue({ ok: false, reason: 'missing' })
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(403)
    expect(mockRenewSession).not.toHaveBeenCalled()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('happy path → rinnova, cookie con max-age residuo e nuovo csrfToken', async () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    const session = validSession(expiresAt)
    mockResolveSession.mockResolvedValue(session)
    mockRenewSession.mockResolvedValue({
      cookieValue: 'k1.new-token',
      csrfToken: 'csrf-new',
      expiresAt,
    })

    const res = await renew(makeRequest(COOKIE))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, csrfToken: 'csrf-new' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mockRenewSession).toHaveBeenCalledWith(expect.anything(), COOKIE, expect.anything())
    expect(mockVerifyCsrf).toHaveBeenCalledWith(expect.anything(), expect.anything(), session)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('fantacer_session=k1.new-token')

    // Max-Age = vita assoluta residua (NON 12h intere).
    const maxAge = mockCookieOptions.mock.calls[0][0] as number
    expect(maxAge).toBeGreaterThan(3500)
    expect(maxAge).toBeLessThanOrEqual(3600)
    expect(maxAge).toBeLessThan(12 * 3600)
  })

  it('errore di renew (config/DB/HMAC) → 503', async () => {
    mockResolveSession.mockResolvedValue(validSession(new Date(Date.now() + 3600_000).toISOString()))
    mockRenewSession.mockResolvedValue(null)
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(503)
  })

  it('keyring assente → 503, nessuna risoluzione', async () => {
    mockKeyring.mockReturnValue(null)
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(503)
    expect(mockRenewSession).not.toHaveBeenCalled()
  })

  it('nessun IP trusted → 503 fail-closed', async () => {
    mockTrustedIp.mockReturnValue({
      ip: null,
      detectedIp: null,
      source: 'none',
      confidence: 'none',
    })
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(503)
    expect(mockEvaluate).not.toHaveBeenCalled()
    expect(mockRenewSession).not.toHaveBeenCalled()
  })

  it('rate-limit enforce oltre soglia → 429 + Retry-After', async () => {
    mockEvaluate.mockResolvedValue({
      mode: 'enforce',
      allowed: false,
      rawAllowed: false,
      retryAfterSec: 90,
      key: 'bootstrap:ip:k1.hash',
    })
    const res = await renew(makeRequest(COOKIE))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('90')
    expect(mockRenewSession).not.toHaveBeenCalled()
  })
})

describe('POST /api/identity/revoke', () => {
  it('senza cookie di sessione → 401, nessuna revoca', async () => {
    const res = await revoke(makeRequest(undefined))
    expect(res.status).toBe(401)
    expect(mockRevokeSession).not.toHaveBeenCalled()
  })

  it('CSRF mancante → 403, nessuna revoca', async () => {
    mockResolveSession.mockResolvedValue(validSession(new Date(Date.now() + 3600_000).toISOString()))
    mockVerifyCsrf.mockReturnValue({ ok: false, reason: 'invalid' })
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(403)
    expect(mockRevokeSession).not.toHaveBeenCalled()
  })

  it('happy path → revoca e cancella il cookie', async () => {
    const session = validSession(new Date(Date.now() + 3600_000).toISOString())
    mockResolveSession.mockResolvedValue(session)
    mockRevokeSession.mockResolvedValue(true)

    const res = await revoke(makeRequest(COOKIE))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mockRevokeSession).toHaveBeenCalledWith(expect.anything(), 'sess-1', 'user')
    expect(mockVerifyCsrf).toHaveBeenCalledWith(expect.anything(), expect.anything(), session)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('fantacer_session=;')
    expect(setCookie).toContain('Max-Age=0')
    expect(mockCookieOptions).toHaveBeenCalledWith(0)
  })

  it('idempotente: sessione già revocata/scaduta → 200 no-op con cookie pulito', async () => {
    mockResolveSession.mockResolvedValue(null)
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mockRevokeSession).not.toHaveBeenCalled()
    expect(res.headers.get('set-cookie')).toContain('fantacer_session=;')
  })

  it('errore DB in revoca → 503 fail-closed', async () => {
    mockResolveSession.mockResolvedValue(validSession(new Date(Date.now() + 3600_000).toISOString()))
    mockRevokeSession.mockResolvedValue(false)
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(503)
  })

  it('keyring assente → 503', async () => {
    mockKeyring.mockReturnValue(null)
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(503)
    expect(mockRevokeSession).not.toHaveBeenCalled()
  })

  it('nessun IP trusted → 503 fail-closed', async () => {
    mockTrustedIp.mockReturnValue({
      ip: null,
      detectedIp: null,
      source: 'none',
      confidence: 'none',
    })
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(503)
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('rate-limit enforce oltre soglia → 429 + Retry-After', async () => {
    mockEvaluate.mockResolvedValue({
      mode: 'enforce',
      allowed: false,
      rawAllowed: false,
      retryAfterSec: 90,
      key: 'bootstrap:ip:k1.hash',
    })
    const res = await revoke(makeRequest(COOKIE))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('90')
    expect(mockRevokeSession).not.toHaveBeenCalled()
  })
})
