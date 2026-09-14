/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET } from '../src/app/api/admin/votes/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireAdmin = requireAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock

const companies = [
  { id: 'c1', name: 'Alpha', batch: 'B1' },
  { id: 'c2', name: 'Beta', batch: 'B1' },
  { id: 'c4', name: 'Zeta', batch: 'B1' },
  { id: 'c5', name: 'Gamma', batch: 'B1' },
  { id: 'c3', name: 'Eta', batch: 'B2' },
  { id: 'cx', name: 'Theta', batch: 'B2' },
  { id: 'cy', name: 'Iota', batch: 'B2' },
]

const mkSession = (
  id: string,
  created_at: string,
  [a, b, c]: [string, string, string],
) => ({
  id,
  fingerprint: 'fp-' + id,
  user_agent: 'Mozilla/5.0',
  country: 'IT',
  company1_id: a,
  company2_id: b,
  company3_id: c,
  pallet1: 4,
  pallet2: 2,
  pallet3: 1,
  created_at,
})

// ordinate per created_at desc come dal DB
const sessions = [
  mkSession('s1', '2026-09-14T12:00:00Z', ['c3', 'cx', 'cy']),
  mkSession('s2', '2026-09-14T11:00:00Z', ['c1', 'c2', 'c4']),
  mkSession('s3', '2026-09-14T10:00:00Z', ['c5', 'c2', 'c1']),
  mkSession('s4', '2026-09-14T09:00:00Z', ['c4', 'c1', 'c2']),
]

function buildSupabase() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'companies') {
        return { select: jest.fn().mockResolvedValue({ data: companies, error: null }) }
      }
      if (table === 'vote_sessions') {
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: sessions, error: null }),
          }),
        }
      }
      throw new Error('unexpected table ' + table)
    }),
  }
}

function getRequest(query: string): NextRequest {
  return { url: `http://localhost/api/admin/votes?${query}` } as unknown as NextRequest
}

describe('GET /api/admin/votes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(undefined)
    mockToAdminError.mockReturnValue(500)
    mockCreateAdminClient.mockReturnValue(buildSupabase())
  })

  it('filtra per batch e pagina i soli record del batch', async () => {
    const res = await GET(getRequest('batch=B1&page=1&limit=1'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination.total).toBe(3)
    expect(data.pagination.pages).toBe(3)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].id).toBe('s2')
  })

  it('la ricerca trova sessioni fuori dalla prima pagina (regression)', async () => {
    const res = await GET(getRequest('batch=B1&search=Gamma&page=1&limit=1'))
    const data = await res.json()

    expect(data.pagination.total).toBe(1)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].pallets[0].company).toBe('Gamma')
  })

  it('senza batch mostra tutti i batch', async () => {
    const res = await GET(getRequest('page=1&limit=50'))
    const data = await res.json()

    expect(data.pagination.total).toBe(4)
  })

  it('filtra per un batch diverso', async () => {
    const res = await GET(getRequest('batch=B2&page=1&limit=50'))
    const data = await res.json()

    expect(data.pagination.total).toBe(1)
    expect(data.data[0].id).toBe('s1')
  })

  it('nega accesso senza admin', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('forbidden'))
    mockToAdminError.mockReturnValue(403)

    const res = await GET(getRequest('page=1'))

    expect(res.status).toBe(403)
  })
})
