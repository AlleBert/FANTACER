import type { NextRequest } from 'next/server'
import {
  requireAdmin,
  requireRoleAdmin,
  AdminAuthError,
} from '../src/lib/admin-auth'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const mockCreateClient = createClient as jest.Mock
const mockCreateAdminClient = createAdminClient as jest.Mock

const USER = { id: 'u1', email: 'a@b.it' }

function makeRequest(): NextRequest {
  return {} as NextRequest
}

function mockServerClient(user: unknown, aal: string): void {
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: jest
          .fn()
          .mockResolvedValue({ data: { currentLevel: aal } }),
      },
    },
  })
}

function mockAdminRow(row: { id: string; role?: string } | null): void {
  const single = jest.fn().mockResolvedValue({ data: row, error: null })
  mockCreateAdminClient.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single }),
        }),
      }),
    }),
  })
}

describe('requireAdmin (role-aware)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('admits admin at AAL2 with role="admin"', async () => {
    mockServerClient(USER, 'aal2')
    mockAdminRow({ id: 'a1', role: 'admin' })
    const ctx = await requireAdmin(makeRequest())
    expect(ctx.role).toBe('admin')
    expect(ctx.aal).toBe('aal2')
  })

  it('rejects admin at AAL1 (MFA obbligatoria)', async () => {
    mockServerClient(USER, 'aal1')
    mockAdminRow({ id: 'a1', role: 'admin' })
    await expect(requireAdmin(makeRequest())).rejects.toMatchObject({
      status: 403,
      message: 'MFA richiesta',
    })
  })

  it('admits viewer at AAL1 with role="viewer"', async () => {
    mockServerClient(USER, 'aal1')
    mockAdminRow({ id: 'v1', role: 'viewer' })
    const ctx = await requireAdmin(makeRequest())
    expect(ctx.role).toBe('viewer')
    expect(ctx.aal).toBe('aal1')
  })

  it('returns 401 when not authenticated', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('no session') }),
      },
    })
    await expect(requireAdmin(makeRequest())).rejects.toMatchObject({
      status: 401,
    })
  })

  it('returns 403 when no valid admin_users row', async () => {
    mockServerClient(USER, 'aal2')
    mockAdminRow(null)
    await expect(requireAdmin(makeRequest())).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('requireRoleAdmin (admin-only)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('admits admin at AAL2', async () => {
    mockServerClient(USER, 'aal2')
    mockAdminRow({ id: 'a1', role: 'admin' })
    const ctx = await requireRoleAdmin(makeRequest())
    expect(ctx.role).toBe('admin')
  })

  it('rejects viewer even at AAL2', async () => {
    mockServerClient(USER, 'aal2')
    mockAdminRow({ id: 'v1', role: 'viewer' })
    await expect(requireRoleAdmin(makeRequest())).rejects.toBeInstanceOf(
      AdminAuthError,
    )
    await expect(requireRoleAdmin(makeRequest())).rejects.toMatchObject({
      status: 403,
      message: 'Operazione consentita solo agli admin',
    })
  })

  it('rejects admin at AAL1', async () => {
    mockServerClient(USER, 'aal1')
    mockAdminRow({ id: 'a1', role: 'admin' })
    await expect(requireRoleAdmin(makeRequest())).rejects.toMatchObject({
      status: 403,
    })
  })
})