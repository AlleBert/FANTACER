/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/admin/votes/reset/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireRoleAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/audit', () => ({ writeAuditEvent: jest.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireRoleAdmin = requireRoleAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock
const mockWriteAuditEvent = writeAuditEvent as jest.Mock

function jsonRequest(body: object): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

describe('POST /api/admin/votes/reset', () => {
  let rpc: jest.Mock
  let supabase: ReturnType<typeof buildSupabase>

  function buildSupabase() {
    rpc = jest.fn()
    return { rpc }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue(undefined)
    mockToAdminError.mockReturnValue(500)
    supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
  })

  it('rejects viewer with 403', async () => {
    mockRequireRoleAdmin.mockRejectedValue(new Error('forbidden'))
    mockToAdminError.mockReturnValue(403)

    const res = await POST(jsonRequest({ scope: 'all' }))

    expect(res.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects invalid scope with 400', async () => {
    const res = await POST(jsonRequest({ scope: 'nope' }))

    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires batch when scope is batch', async () => {
    const res = await POST(jsonRequest({ scope: 'batch' }))

    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('resets all votes via RPC and writes audit', async () => {
    rpc.mockResolvedValue({ data: { success: true, votes_deleted: 5, stats_deleted: 3 }, error: null })

    const res = await POST(jsonRequest({ scope: 'all' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('admin_reset_votes', { p_scope: 'all', p_batch: null })
    expect(data.votes_deleted).toBe(5)
    expect(data.stats_deleted).toBe(3)
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'admin_votes_reset', metadata: expect.objectContaining({ scope: 'all' }) })
    )
  })

  it('passes batch to RPC for batch scope', async () => {
    rpc.mockResolvedValue({ data: { success: true, votes_deleted: 2, stats_deleted: 1 }, error: null })

    const res = await POST(jsonRequest({ scope: 'batch', batch: 'B1' }))

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('admin_reset_votes', { p_scope: 'batch', p_batch: 'B1' })
  })

  it('returns 500 on RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const res = await POST(jsonRequest({ scope: 'all' }))

    expect(res.status).toBe(500)
    expect(mockWriteAuditEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when RPC reports failure', async () => {
    rpc.mockResolvedValue({ data: { success: false, error: 'scope non valido' }, error: null })

    const res = await POST(jsonRequest({ scope: 'all' }))

    expect(res.status).toBe(400)
    expect(mockWriteAuditEvent).not.toHaveBeenCalled()
  })
})