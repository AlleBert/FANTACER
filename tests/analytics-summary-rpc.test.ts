/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET } from '../src/app/api/analytics/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(async () => ({ role: 'admin' })),
  requireRoleAdmin: jest.fn(async () => ({ role: 'admin' })),
  toAdminError: jest.fn(() => 500),
}))

import { createAdminClient } from '@/lib/supabase/admin'

const summary = {
  totalVotes: 1629, uniqueVoters: 1513, todayVotes: 1084, yesterdayVotes: 405, activeNow: 3,
  dailyStats: [{ date: '2026-09-23', vote_count: 1084, unique_voters: 1000 }],
  hourlyByDay: { '2026-09-23': [{ hour: 0, votes: 0 }] },
}

function build() {
  return {
    rpc: jest.fn(async (name: string) => {
      if (name === 'admin_analytics_summary') return { data: summary, error: null }
      return { data: null, error: null }
    }),
    from: jest.fn(() => ({
      select: jest.fn(() => ({ gte: jest.fn().mockResolvedValue({ count: 5, error: null }) })),
    })),
  }
}

function req(qs = ''): NextRequest {
  return { url: `http://localhost/api/analytics?type=summary${qs}` } as unknown as NextRequest
}

it('usa la RPC e restituisce i totali completi', async () => {
  const supabase = build()
  ;(createAdminClient as jest.Mock).mockReturnValue(supabase)
  const res = await GET(req('&batch=cersaie_14092026'))
  const data = await res.json()
  expect(res.status).toBe(200)
  expect(supabase.rpc).toHaveBeenCalledWith('admin_analytics_summary', { p_batch: 'cersaie_14092026' })
  expect(data.totalVotes).toBe(1629)
  expect(data.uniqueVoters).toBe(1513)
  expect(data.onlineUsers).toBe(5)
})
