/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../src/app/api/vota/status/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/vote-dev-bypass', () => ({ resolveFingerprint: (v: string) => v }))

import { createAdminClient } from '@/lib/supabase/admin'

const mockCreateAdminClient = createAdminClient as jest.Mock

const SESSION = {
  company1_id: 'c1',
  company2_id: 'c2',
  company3_id: 'c3',
  pallet1: 4,
  pallet2: 2,
  pallet3: 1,
}

const COMPANIES = [
  { id: 'c1', name: 'Alpha' },
  { id: 'c2', name: 'Beta' },
  { id: 'c3', name: 'Gamma' },
]

function buildSupabase(session: unknown, companies: unknown) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: session, error: null })
  const limit = jest.fn().mockReturnValue({ maybeSingle })
  const lt = jest.fn().mockReturnValue({ limit })
  const gte = jest.fn().mockReturnValue({ lt })
  const eq = jest.fn().mockReturnValue({ gte })
  const selectVotes = jest.fn().mockReturnValue({ eq })
  const inFn = jest.fn().mockResolvedValue({ data: companies, error: null })
  const selectCompanies = jest.fn().mockReturnValue({ in: inFn })
  return {
    from: jest.fn((table: string) =>
      table === 'vote_sessions' ? { select: selectVotes } : { select: selectCompanies },
    ),
  }
}

function postRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/vota/status', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400 senza visitorId', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
  })

  it("voted:false se non c'è una sessione oggi", async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(null, []))
    const res = await POST(postRequest({ visitorId: 'v1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ voted: false })
  })

  it('voted:true con aziende e pallet reali', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(SESSION, COMPANIES))
    const res = await POST(postRequest({ visitorId: 'v1' }))
    const data = await res.json()
    expect(data.voted).toBe(true)
    expect(data.companies).toEqual([
      { id: 'c1', name: 'Alpha', pallet: 4 },
      { id: 'c2', name: 'Beta', pallet: 2 },
      { id: 'c3', name: 'Gamma', pallet: 1 },
    ])
  })
})
