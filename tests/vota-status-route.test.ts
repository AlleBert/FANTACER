/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST, utcDayBounds } from '../src/app/api/vota/status/route'

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

function buildSupabase(
  session: unknown,
  companies: unknown,
  opts?: { votesError?: unknown; companiesError?: unknown },
) {
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: opts?.votesError ? null : session, error: opts?.votesError ?? null })
  const limit = jest.fn().mockReturnValue({ maybeSingle })
  const lt = jest.fn().mockReturnValue({ limit })
  const gte = jest.fn().mockReturnValue({ lt })
  const eq = jest.fn().mockReturnValue({ gte })
  const selectVotes = jest.fn().mockReturnValue({ eq })
  const inFn = jest
    .fn()
    .mockResolvedValue({
      data: opts?.companiesError ? null : companies,
      error: opts?.companiesError ?? null,
    })
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

function malformedRequest(): NextRequest {
  return { json: async () => Promise.reject(new Error('bad json')) } as unknown as NextRequest
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

  it('500 se la query vote_sessions fallisce', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase(null, [], { votesError: { message: 'boom' } }),
    )
    const res = await POST(postRequest({ visitorId: 'v1' }))
    expect(res.status).toBe(500)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('500 se la query companies fallisce', async () => {
    mockCreateAdminClient.mockReturnValue(
      buildSupabase(SESSION, null, { companiesError: { message: 'boom' } }),
    )
    const res = await POST(postRequest({ visitorId: 'v1' }))
    expect(res.status).toBe(500)
  })

  it('400 con body JSON malformato', async () => {
    const res = await POST(malformedRequest())
    expect(res.status).toBe(400)
  })

  it('400 con visitorId troppo lungo', async () => {
    const res = await POST(postRequest({ visitorId: 'x'.repeat(129) }))
    expect(res.status).toBe(400)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('success response ha Cache-Control no-store', async () => {
    mockCreateAdminClient.mockReturnValue(buildSupabase(SESSION, COMPANIES))
    const res = await POST(postRequest({ visitorId: 'v1' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('utcDayBounds', () => {
  it('calcola i confini della giornata UTC', () => {
    const { start, end } = utcDayBounds(new Date('2026-09-14T12:00:00Z'))
    expect(start).toBe('2026-09-14T00:00:00.000Z')
    expect(end).toBe('2026-09-15T00:00:00.000Z')
  })
})
