/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET, POST, summarizeRiskFindings } from '../src/app/api/admin/votes/quarantine/route'
import { POST as reconcilePOST } from '../src/app/api/admin/votes/reconcile/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(),
  requireRoleAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/audit', () => ({ writeAuditEvent: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => true),
  getClientIp: jest.fn(() => null),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireAdmin = requireAdmin as jest.Mock
const mockRequireRoleAdmin = requireRoleAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock
const mockWriteAuditEvent = writeAuditEvent as jest.Mock
const mockCheckRateLimit = checkRateLimit as jest.Mock

const ADMIN_CTX = {
  user: { id: 'user-1', email: 'admin@example.com' },
  aal: 'aal2',
  role: 'admin',
}

const COUNTS = { accepted: 10, quarantined: 2, rejected: 1, total: 13 }

const quarantineRows = [
  {
    id: 42,
    created_at: '2026-09-24T10:00:00Z',
    status: 'quarantined',
    fingerprint: 'v2:principal-42-abcdef',
    country: 'IT',
    review_actor: null,
    reviewed_at: null,
    review_reason: 'Correlazione sospetta',
    risk_findings: { ip_hmac: 'hmac-abc', ip_address: '1.2.3.4' },
  },
  {
    id: 43,
    created_at: '2026-09-24T09:00:00Z',
    status: 'rejected',
    fingerprint: 'v2:principal-43',
    country: 'IT',
    review_actor: 'admin@example.com',
    reviewed_at: '2026-09-24T09:30:00Z',
    review_reason: 'Bot',
    risk_findings: null,
  },
]

function buildGetSupabase() {
  const countsRpc = jest.fn().mockResolvedValue({
    data: { success: true, totals: COUNTS, by_day: [] },
    error: null,
  })
  const limit = jest.fn().mockResolvedValue({ data: quarantineRows, error: null })
  const order2 = jest.fn(() => ({ limit }))
  const order1 = jest.fn(() => ({ order: order2 }))
  const inFn = jest.fn(() => ({ order: order1 }))
  const select = jest.fn(() => ({ in: inFn }))
  const from = jest.fn(() => ({ select }))
  return { rpc: countsRpc, from }
}

function buildPostSupabase() {
  const rpc = jest.fn()
  return { rpc }
}

function getRequest(query = ''): NextRequest {
  return { url: `http://localhost/api/admin/votes/quarantine?${query}` } as unknown as NextRequest
}

function postRequest(body: object): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

describe('summarizeRiskFindings', () => {
  it('strips PII keys and keeps server-derived signals', () => {
    expect(
      summarizeRiskFindings({ ip_hmac: 'h', ip_address: '1.2.3.4', botd_bucket: 'low' }),
    ).toEqual({ ip_hmac: 'h', botd_bucket: 'low' })
  })

  it('returns null for non-objects', () => {
    expect(summarizeRiskFindings(null)).toBeNull()
    expect(summarizeRiskFindings(['a'])).toBeNull()
    expect(summarizeRiskFindings('x')).toBeNull()
  })
})

describe('GET /api/admin/votes/quarantine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN_CTX)
    mockToAdminError.mockReturnValue(500)
    mockCreateAdminClient.mockReturnValue(buildGetSupabase())
  })

  it('viewer riceve 200 con conteggi e lista (requireAdmin)', async () => {
    mockRequireAdmin.mockResolvedValue({ ...ADMIN_CTX, role: 'viewer' })

    const res = await GET(getRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.counts).toEqual(COUNTS)
    expect(data.votes).toHaveLength(2)
    expect(data.votes[0].id).toBe('42')
    expect(data.votes[0].reviewReason).toBe('Correlazione sospetta')
  })

  it('non espone PII nei risk findings', async () => {
    const res = await GET(getRequest())
    const data = await res.json()

    expect(data.votes[0].riskFindings).toEqual({ ip_hmac: 'hmac-abc' })
  })

  it('nega accesso non autenticato', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('unauthorized'))
    mockToAdminError.mockReturnValue(401)

    const res = await GET(getRequest())

    expect(res.status).toBe(401)
  })
})

describe('POST /api/admin/votes/quarantine', () => {
  let rpc: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue(ADMIN_CTX)
    mockToAdminError.mockReturnValue(500)
    mockCheckRateLimit.mockResolvedValue(true)
    const supabase = buildPostSupabase()
    rpc = supabase.rpc
    mockCreateAdminClient.mockReturnValue(supabase)
  })

  it('viewer riceve 403 e nessuna RPC', async () => {
    mockRequireRoleAdmin.mockRejectedValue(new Error('forbidden'))
    mockToAdminError.mockReturnValue(403)

    const res = await POST(postRequest({ voteId: 42, status: 'accepted' }))

    expect(res.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('stato non valido → 400 senza RPC', async () => {
    const res = await POST(postRequest({ voteId: 42, status: 'nope' }))

    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('voteId non valido → 400', async () => {
    const res = await POST(postRequest({ voteId: 'abc', status: 'accepted' }))

    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rate limit superato → 429 senza RPC', async () => {
    mockCheckRateLimit.mockResolvedValue(false)

    const res = await POST(postRequest({ voteId: 42, status: 'accepted' }))

    expect(res.status).toBe(429)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('chiama admin_review_vote con actor e scrive audit', async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        vote_id: 42,
        previous_status: 'quarantined',
        status: 'accepted',
        changed: true,
        idempotent: false,
      },
      error: null,
    })

    const res = await POST(postRequest({ voteId: 42, status: 'accepted', reason: 'ok' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.changed).toBe(true)
    expect(rpc).toHaveBeenCalledWith('admin_review_vote', {
      p_vote_id: 42,
      p_status: 'accepted',
      p_actor: 'admin@example.com',
      p_reason: 'ok',
    })
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin_vote_review',
        metadata: expect.objectContaining({ vote_id: 42, status: 'accepted' }),
      }),
    )
  })

  it('idempotency passthrough: risposta e audit coerenti', async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        vote_id: 42,
        previous_status: 'accepted',
        status: 'accepted',
        changed: false,
        idempotent: true,
      },
      error: null,
    })

    const res = await POST(postRequest({ voteId: 42, status: 'accepted' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.idempotent).toBe(true)
    expect(data.changed).toBe(false)
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin_vote_review',
        metadata: expect.objectContaining({ idempotent: true }),
      }),
    )
  })

  it('vote_not_found → 404', async () => {
    rpc.mockResolvedValue({
      data: { success: false, code: 'vote_not_found', message: 'Voto non trovato' },
      error: null,
    })

    const res = await POST(postRequest({ voteId: 42, status: 'accepted' }))

    expect(res.status).toBe(404)
    expect(mockWriteAuditEvent).not.toHaveBeenCalled()
  })

  it('errore RPC → 500', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const res = await POST(postRequest({ voteId: 42, status: 'accepted' }))

    expect(res.status).toBe(500)
    expect(mockWriteAuditEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/votes/reconcile', () => {
  let rpc: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue(ADMIN_CTX)
    mockToAdminError.mockReturnValue(500)
    mockCheckRateLimit.mockResolvedValue(true)
    const supabase = buildPostSupabase()
    rpc = supabase.rpc
    mockCreateAdminClient.mockReturnValue(supabase)
  })

  it('viewer riceve 403', async () => {
    mockRequireRoleAdmin.mockRejectedValue(new Error('forbidden'))
    mockToAdminError.mockReturnValue(403)

    const res = await reconcilePOST(postRequest({}))

    expect(res.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rate limit → 429 senza RPC', async () => {
    mockCheckRateLimit.mockResolvedValue(false)

    const res = await reconcilePOST(postRequest({}))

    expect(res.status).toBe(429)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('chiama admin_reconcile_totals e scrive audit', async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        changed: true,
        companies_changed: 2,
        before: { companies: 2 },
        after: { companies: 2 },
      },
      error: null,
    })

    const res = await reconcilePOST(postRequest({}))

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('admin_reconcile_totals')
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin_totals_reconcile',
        metadata: expect.objectContaining({ companies_changed: 2 }),
      }),
    )
  })

  it('errore RPC → 500', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const res = await reconcilePOST(postRequest({}))

    expect(res.status).toBe(500)
    expect(mockWriteAuditEvent).not.toHaveBeenCalled()
  })
})
