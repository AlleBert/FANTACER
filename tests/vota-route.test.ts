/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/vota/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/supabase/batch', () => ({ getActiveBatch: jest.fn() }))
jest.mock('@/lib/supabase/vote-api', () => ({ submitVote: jest.fn() }))
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

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockGetActiveBatch = getActiveBatch as jest.Mock
const mockSubmitVote = submitVote as jest.Mock

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
    mockSubmitVote.mockResolvedValue({ success: true })
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
})
