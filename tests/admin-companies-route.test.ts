/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET } from '../src/app/api/admin/companies/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(async () => ({ role: 'admin' })),
  toAdminError: jest.fn(() => 500),
}))

import { createAdminClient } from '@/lib/supabase/admin'

const rows = [
  { id: 'refin', name: 'REFIN', category: null, image_url: null, effective_pallets: 1284, effective_votes: 300, today_votes: 40, yesterday_votes: 20, blocked: false, has_override: true },
  { id: 'mar', name: 'MARINER', category: 'x', image_url: null, effective_pallets: 2000, effective_votes: 500, today_votes: 60, yesterday_votes: 30, blocked: false, has_override: false },
]

function req(): NextRequest {
  return { url: 'http://localhost/api/admin/companies?batch=B1' } as unknown as NextRequest
}

it('usa admin_company_stats e ordina per punti effettivi', async () => {
  const supabase = { rpc: jest.fn(async () => ({ data: rows, error: null })) }
  ;(createAdminClient as jest.Mock).mockReturnValue(supabase)
  const res = await GET(req())
  const data = await res.json()
  expect(res.status).toBe(200)
  expect(supabase.rpc).toHaveBeenCalledWith('admin_company_stats', { p_batch: 'B1' })
  expect(data.data[0].name).toBe('MARINER')
  expect(data.data[0].rank).toBe(1)
  expect(data.data.find((c: { id: string }) => c.id === 'refin').votes).toBe(1284)
  expect(data.data.find((c: { id: string }) => c.id === 'refin').manualScore).toBe(true)
})
