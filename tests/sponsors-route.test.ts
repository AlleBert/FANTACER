/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { PUT } from '../src/app/api/admin/sponsors/route'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: jest.fn(),
  requireRoleAdmin: jest.fn(),
  toAdminError: jest.fn(() => 500),
}))

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin } from '@/lib/admin-auth'

const mockCreateAdminClient = createAdminClient as jest.Mock
const mockRequireRoleAdmin = requireRoleAdmin as jest.Mock

const BASE = 'https://xyz.supabase.co'
const OLD_URL = `${BASE}/storage/v1/object/public/sponsor-logos/sponsors/old.png`

function jsonRequest(body: object): NextRequest {
  return {
    headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  } as unknown as NextRequest
}

function formRequest(
  file: { name: string; size: number; type: string } | null,
  fields: Record<string, string> = {},
): NextRequest {
  const has = (k: string) => (k === 'file' ? file != null : k in fields)
  const get = (k: string) => (k === 'file' ? file : fields[k] ?? null)
  return {
    headers: { get: (name: string) => (name === 'content-type' ? 'multipart/form-data; boundary=test' : null) },
    formData: async () => ({ has, get }),
  } as unknown as NextRequest
}

describe('PUT /api/admin/sponsors', () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

  let upload: jest.Mock
  let remove: jest.Mock
  let singleSelect: jest.Mock
  let singleUpdate: jest.Mock
  let update: jest.Mock
  let supabase: ReturnType<typeof buildSupabase>

  afterAll(() => {
    if (ORIGINAL_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL
    }
  })

  function buildSupabase() {
    upload = jest.fn()
    remove = jest.fn(async () => ({ error: null }))
    singleSelect = jest.fn()
    singleUpdate = jest.fn()
    update = jest.fn()
    const chain = {
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: singleSelect })) })),
      update: jest.fn((payload: object) => {
        update(payload)
        return { eq: jest.fn(() => ({ select: jest.fn(() => ({ single: singleUpdate })) })) }
      }),
    }
    return {
      storage: { from: jest.fn().mockReturnValue({ upload, remove }) },
      from: jest.fn().mockReturnValue(chain),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireRoleAdmin.mockResolvedValue(undefined)
    process.env.NEXT_PUBLIC_SUPABASE_URL = BASE
    supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
  })

  it('JSON PUT with image_url null clears the logo', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', image_url: null }, error: null })

    const res = await PUT(jsonRequest({ id: 's1', name: 'Acme', image_url: null }))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].image_url).toBeNull()
    expect(res.status).toBe(200)
  })

  it('JSON PUT keeps the provided image_url value', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', image_url: 'https://cdn.it/logo.png' }, error: null })

    const res = await PUT(jsonRequest({ id: 's1', name: 'Acme', image_url: 'https://cdn.it/logo.png' }))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].image_url).toBe('https://cdn.it/logo.png')
    expect(res.status).toBe(200)
  })

  it('multipart PUT without a file preserves the existing image_url', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', image_url: OLD_URL }, error: null })

    const res = await PUT(formRequest(null, { id: 's1', name: 'Acme' }))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].image_url).toBe(OLD_URL)
    expect(res.status).toBe(200)
  })

  it('multipart PUT with a file removes the old logo on success', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', image_url: 'new' }, error: null })
    upload.mockResolvedValue({ data: { path: 'sponsors/uploaded.png' }, error: null })

    const res = await PUT(formRequest({ name: 'logo.png', size: 10, type: 'image/png' }, { id: 's1', name: 'Acme' }))

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].image_url).toMatch(
      /^https:\/\/xyz\.supabase\.co\/storage\/v1\/object\/public\/sponsor-logos\/sponsors\/[0-9a-f-]+\.png$/
    )
    expect(remove).toHaveBeenCalledTimes(1)
    const removed = remove.mock.calls[0][0] as string[]
    expect(removed).toEqual(['sponsors/old.png'])
  })

  it('JSON full-object PUT preserves image_url and does not remove storage', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', image_url: OLD_URL, is_active: false }, error: null })

    const res = await PUT(jsonRequest({ id: 's1', name: 'Acme', image_url: OLD_URL, is_active: false, sort_order: 2 }))

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].image_url).toBe(OLD_URL)
    expect(update.mock.calls[0][0].is_active).toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })

  it('multipart PUT removes the newly uploaded logo when the update fails', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: null, error: { message: 'DB fail' } })
    upload.mockResolvedValue({ data: { path: 'sponsors/uploaded.png' }, error: null })

    const res = await PUT(formRequest({ name: 'logo.png', size: 10, type: 'image/png' }, { id: 's1', name: 'Acme' }))

    expect(res.status).toBe(500)
    expect(remove).toHaveBeenCalledTimes(1)
    const removed = remove.mock.calls[0][0] as string[]
    expect(removed).toHaveLength(1)
    expect(removed[0]).toMatch(/^sponsors\/[0-9a-f-]+\.png$/)
  })
})
