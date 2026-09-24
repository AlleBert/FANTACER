/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { GET, POST } from '../src/app/api/admin/companies/backup/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(async () => ({ role: 'admin' })),
  requireRoleAdmin: jest.fn(async () => ({ role: 'admin' })),
  toAdminError: jest.fn(() => 500),
}))
jest.mock('@/lib/audit', () => ({ writeAuditEvent: jest.fn(async () => {}) }))
jest.mock('@/lib/request-ip', () => ({ getTrustedClientIp: jest.fn(() => ({ ip: '1.2.3.4' })) }))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'

const mockCreate = createAdminClient as jest.Mock
const mockRequireRole = requireRoleAdmin as jest.Mock
const mockToAdminError = toAdminError as jest.Mock
const mockAudit = writeAuditEvent as jest.Mock

function req(body?: unknown, url = 'http://localhost/api/admin/companies/backup'): NextRequest {
  return { json: async () => body, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireRole.mockResolvedValue({ role: 'admin' })
  mockToAdminError.mockReturnValue(500)
})

it('GET elenco backup', async () => {
  const supabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
        })),
      })),
    })),
  }
  mockCreate.mockReturnValue(supabase)
  const res = await GET(req())
  expect(res.status).toBe(200)
  expect((await res.json()).data).toHaveLength(1)
})

it('POST restore chiama la RPC e scrive audit', async () => {
  const supabase = { rpc: jest.fn(async () => ({ data: { success: true, restored: 2 }, error: null })) }
  mockCreate.mockReturnValue(supabase)
  const res = await POST(req({ restoreBackupId: 7 }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ success: true, restored: 2 })
  expect(supabase.rpc).toHaveBeenCalledWith('admin_restore_company_state', { p_backup_id: 7 })
  expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'admin_company_restore' }))
})

it('POST 400 senza restoreBackupId', async () => {
  const res = await POST(req({}))
  expect(res.status).toBe(400)
})

it('POST 403 se auth fallisce', async () => {
  mockRequireRole.mockRejectedValue(new Error('forbidden'))
  mockToAdminError.mockReturnValue(403)
  const res = await POST(req({ restoreBackupId: 1 }))
  expect(res.status).toBe(403)
})

it('POST 400 se la RPC ritorna success:false', async () => {
  const supabase = { rpc: jest.fn(async () => ({ data: { success: false, error: 'backup non trovato' }, error: null })) }
  mockCreate.mockReturnValue(supabase)
  const res = await POST(req({ restoreBackupId: 999 }))
  expect(res.status).toBe(400)
})
