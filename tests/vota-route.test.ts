/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/vota/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/supabase/batch', () => ({ getActiveBatch: jest.fn() }))
jest.mock('@/lib/supabase/vote-api', () => ({ submitVote: jest.fn() }))
jest.mock('@/lib/site-flags', () => ({ getAntibotEnabled: jest.fn() }))
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
jest.mock('@/lib/locale', () => ({
  LOCALE_COOKIE: 'fantacer_locale',
  resolveLocale: () => 'it',
}))
jest.mock('@/i18n', () => ({ translate: (_locale: string, key: string) => key }))

import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveBatch } from '@/lib/supabase/batch'
import { submitVote } from '@/lib/supabase/vote-api'
import { getAntibotEnabled } from '@/lib/site-flags'
import { verifyTurnstile } from '@/lib/turnstile'
import { evaluateVoteRateLimit } from '@/lib/vote-rate-limit'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockGetActiveBatch = getActiveBatch as jest.Mock
const mockSubmitVote = submitVote as jest.Mock
const mockGetAntibotEnabled = getAntibotEnabled as jest.Mock
const mockVerifyTurnstile = verifyTurnstile as jest.Mock
const mockEvaluateVoteRateLimit = evaluateVoteRateLimit as jest.Mock

const UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LEGACY_FP = 'b9e2ed7ea02c48153440fe332da039e8'

const COMPANY_IDS = ['c1', 'c2', 'c3']

function buildAdmin() {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn().mockResolvedValue({
          data: COMPANY_IDS.map((id) => ({ id, batch: 'TEST' })),
          error: null,
        }),
      })),
    })),
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
  return {
    company1Id: 'c1',
    company2Id: 'c2',
    company3Id: 'c3',
    turnstile_token: 'tok',
    botd: '',
    visitorId: LEGACY_FP,
    voterId: UUID,
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
    mockSubmitVote.mockResolvedValue({ success: true })
    mockVerifyTurnstile.mockResolvedValue({ ok: true })
  })

  it('423 quando l\'anti-bot è attivo (voto sospeso server-side)', async () => {
    mockGetAntibotEnabled.mockResolvedValue(true)
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(423)
    expect(await res.json()).toEqual({ error: 'voteError.antibot' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 senza UUID valido (né cookie né payload)', async () => {
    const res = await POST(makeRequest(validBody({ voterId: undefined })))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingVoterId' })
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 con solo visitorId legacy (non UUID)', async () => {
    const res = await POST(makeRequest(validBody({ voterId: undefined, visitorId: LEGACY_FP })))
    expect(res.status).toBe(400)
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('registra il voto con chiave versionata v1:<uuid> dal payload', async () => {
    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`fantacer_voter_id=${UUID}`)
  })

  it('il cookie identità ha precedenza sul voterId del payload', async () => {
    const res = await POST(makeRequest(validBody({ voterId: OTHER_UUID }), { cookie: UUID }))

    expect(res.status).toBe(200)
    expect(mockSubmitVote).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: `v1:${UUID}` }),
    )
  })

  it('stesso visitorId con UUID diversi: entrambi votano (collisione risolta)', async () => {
    const first = await POST(makeRequest(validBody({ voterId: UUID })))
    const second = await POST(makeRequest(validBody({ voterId: OTHER_UUID })))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const keys = mockSubmitVote.mock.calls.map((c) => c[0].fingerprint)
    expect(new Set(keys).size).toBe(2)
    expect(keys).toContain(`v1:${UUID}`)
    expect(keys).toContain(`v1:${OTHER_UUID}`)
  })

  it('409 quando la RPC risponde "Hai già votato oggi"', async () => {
    mockSubmitVote.mockResolvedValue({ success: false, error: 'Hai già votato oggi' })
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'voteError.alreadyVoted' })
  })

  it('400 senza campi azienda (ma con UUID valido)', async () => {
    const res = await POST(makeRequest(validBody({ company1Id: undefined })))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingFields' })
  })

  it('400 senza turnstile_token: nessuna scrittura DB', async () => {
    const res = await POST(makeRequest(validBody({ turnstile_token: undefined })))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'voteError.missingSecurity' })
    expect(mockVerifyTurnstile).not.toHaveBeenCalled()
    expect(mockSubmitVote).not.toHaveBeenCalled()
  })

  it('400 se Turnstile fallisce: risposta neutra e nessuna scrittura DB', async () => {
    mockVerifyTurnstile.mockResolvedValue({ ok: false, reason: 'hostname_not_allowed' })
    const res = await POST(makeRequest(validBody()))
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

    const res = await POST(makeRequest(validBody()))
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

    const res = await POST(makeRequest(validBody()))
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

    await POST(makeRequest(validBody()))

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
