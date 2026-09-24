/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET, PUT } from '../src/app/api/admin/settings/fair-end/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(async () => ({ role: 'admin' })),
  requireRoleAdmin: jest.fn(async () => ({ role: 'admin' })),
  toAdminError: jest.fn(() => 500),
}))

import { createAdminClient } from '@/lib/supabase/admin'

function req(body?: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

it('GET legge enabled + config', async () => {
  const supabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn().mockResolvedValue({
          data: [
            { key: 'fair_end_enabled', value: 'true' },
            { key: 'fair_end_config', value: '{"revealTime":"12:30","revealAt":"2026-09-25T10:30:00.000Z","ceremony":{"1":"14:00","2":"13:45","3":"13:30"}}' },
          ],
          error: null,
        }),
      })),
    })),
  }
  ;(createAdminClient as jest.Mock).mockReturnValue(supabase)
  const res = await GET(req())
  const data = await res.json()
  expect(res.status).toBe(200)
  expect(data.enabled).toBe(true)
  expect(data.revealTime).toBe('12:30')
  expect(data.ceremony['1']).toBe('14:00')
})

it('PUT 400 con orario non valido', async () => {
  const res = await PUT(req({ enabled: true, revealTime: '99:99' }))
  expect(res.status).toBe(400)
})

it('PUT 200 aggiorna e calcola revealAt', async () => {
  const supabase = { from: jest.fn(() => ({ upsert: jest.fn(async () => ({ error: null })) })) }
  ;(createAdminClient as jest.Mock).mockReturnValue(supabase)
  const res = await PUT(req({ enabled: true, revealTime: '12:30', ceremony: { '1': '14:00', '2': '13:45', '3': '13:30' } }))
  const data = await res.json()
  expect(res.status).toBe(200)
  expect(typeof data.revealAt).toBe('string')
  expect(supabase.from).toHaveBeenCalledTimes(1)
})
