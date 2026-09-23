/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/admin/companies/apply/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireRoleAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/audit', () => ({ writeAuditEvent: jest.fn(async () => {}) }))
jest.mock('@/lib/request-ip', () => ({ getTrustedClientIp: jest.fn(() => ({ ip: '1.2.3.4' })) }))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireRoleAdmin = requireRoleAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock
const mockWriteAudit = writeAuditEvent as jest.Mock

function buildSupabase(rpcImpl?: (name: string) => unknown) {
  return {
    rpc: jest.fn(async (name: string) => {
      if (name === 'admin_backup_company_state') {
        return { data: { success: true, backup_id: 7, company_count: 2 }, error: null }
      }
      if (rpcImpl) return rpcImpl(name)
      return { data: { success: true }, error: null }
    }),
  }
}

function postRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/admin/companies/apply', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue({ role: 'admin', user: { id: 'u1' } })
    mockToAdminError.mockReturnValue(500)
    mockCreateAdminClient.mockReturnValue(buildSupabase())
  })

  it('400 senza companyIds', async () => {
    const res = await POST(postRequest({ blocked: true }))
    expect(res.status).toBe(400)
  })

  it('crea il backup di stato prima di qualunque azione', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    await POST(postRequest({ companyIds: ['refin'], blocked: true }))
    const calls = supabase.rpc.mock.calls.map((c) => c[0])
    expect(calls[0]).toBe('admin_backup_company_state')
  })

  it('deleteVotes chiama admin_delete_company_votes', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    const res = await POST(postRequest({ companyIds: ['refin'], deleteVotes: true, reason: 'bot' }))
    expect(res.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_company_votes', {
      p_company_ids: ['refin'],
      p_reason: 'bot',
    })
  })

  it('score oggetto chiama admin_set_company_score', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    await POST(postRequest({ companyIds: ['refin'], score: { pallets: 10, votes: 5 } }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_company_score', {
      p_company_ids: ['refin'],
      p_pallets: 10,
      p_votes: 5,
    })
  })

  it('score null chiama admin_clear_company_score', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    await POST(postRequest({ companyIds: ['refin'], score: null }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_clear_company_score', {
      p_company_ids: ['refin'],
    })
  })

  it('blocked chiama admin_set_company_blocked', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    await POST(postRequest({ companyIds: ['refin'], blocked: false }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_company_blocked', {
      p_company_ids: ['refin'],
      p_blocked: false,
    })
  })

  it('scrive audit admin_company_action', async () => {
    await POST(postRequest({ companyIds: ['refin'], blocked: true }))
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'admin_company_action' }),
    )
  })

  it('se il backup fallisce non esegue mutazioni', async () => {
    const supabase = {
      rpc: jest.fn(async () => ({ data: null, error: { message: 'boom' } })),
    }
    mockCreateAdminClient.mockReturnValue(supabase)
    const res = await POST(postRequest({ companyIds: ['refin'], blocked: true }))
    expect(res.status).toBe(500)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })
})
