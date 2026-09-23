/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/admin/companies/preview/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireRoleAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/supabase/batch', () => ({ getActiveBatch: jest.fn(async () => 'B1') }))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireRoleAdmin = requireRoleAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock

const companies = [
  { id: 'refin', name: 'REFIN', blocked: false },
  { id: 'dts', name: 'REFIN-DTS-CITY', blocked: false },
  { id: 'mar', name: 'MARINER', blocked: false },
]
const totals = [
  { company_id: 'refin', total_pallets: 100, vote_count: 30 },
  { company_id: 'dts', total_pallets: 60, vote_count: 25 },
  { company_id: 'mar', total_pallets: 80, vote_count: 20 },
]
const sessions = [
  { company1_id: 'refin', company2_id: 'dts', company3_id: 'mar', pallet1: 4, pallet2: 2, pallet3: 1 },
]

function buildSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: companies, error: null }),
          }),
        }
      }
      if (table === 'company_totals') {
        return { select: jest.fn().mockResolvedValue({ data: totals, error: null }) }
      }
      if (table === 'company_score_overrides') {
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === 'vote_sessions') {
        return {
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(async (from: number, to: number) => ({
                data: sessions.slice(from, to + 1),
                error: null,
              })),
            })),
          })),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  }
}

function postRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/admin/companies/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue({ role: 'admin' })
    mockToAdminError.mockReturnValue(500)
    mockCreateAdminClient.mockReturnValue(buildSupabase())
  })

  it('400 senza companyIds', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
  })

  it('403 se auth fallisce', async () => {
    mockRequireRoleAdmin.mockRejectedValue(new Error('forbidden'))
    mockToAdminError.mockReturnValue(403)
    const res = await POST(postRequest({ companyIds: ['refin'] }))
    expect(res.status).toBe(403)
  })

  it('200 con before/after per il blocco', async () => {
    const res = await POST(postRequest({ companyIds: ['refin'], blocked: true }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.before.find((c: { id: string }) => c.id === 'refin')).toBeDefined()
    expect(data.after.find((c: { id: string }) => c.id === 'refin')).toBeUndefined()
  })

  it('con deleteVotes legge vote_sessions e riporta impatto', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    const res = await POST(postRequest({ companyIds: ['refin'], deleteVotes: true }))
    const data = await res.json()
    expect(supabase.from).toHaveBeenCalledWith('vote_sessions')
    expect(data.impact.sessionsDeleted).toBe(1)
  })

  it('senza deleteVotes non legge vote_sessions', async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    await POST(postRequest({ companyIds: ['refin'], blocked: true }))
    expect(supabase.from).not.toHaveBeenCalledWith('vote_sessions')
  })
})
