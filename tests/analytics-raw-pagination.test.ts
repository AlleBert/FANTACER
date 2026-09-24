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

it('export CSV non tronca a 1000 righe', async () => {
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: i,
      created_at: '2026-09-23T10:00:00Z', fingerprint: `fp${i}`, country: 'IT', user_agent: 'ua',
      company1_id: 'c1', company2_id: 'c2', company3_id: 'c3', pallet1: 4, pallet2: 2, pallet3: 1,
    }))
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'companies') {
        return { select: jest.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'A', batch: null }], error: null }) }
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn(() => ({
                range: jest.fn(async (from: number) => ({ data: mk(from === 0 ? 1000 : 400), error: null })),
              })),
            })),
          })),
        })),
      }
    }),
  }
  ;(createAdminClient as jest.Mock).mockReturnValue(supabase)
  const res = await GET({ url: 'http://localhost/api/analytics?type=export&format=csv' } as unknown as NextRequest)
  const text = await res.text()
  const lines = text.trim().split('\n')
  expect(lines.length).toBe(1401) // header + 1400
})
