/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST, PUT, DELETE } from '../src/app/api/admin/sponsors/route'
import { SPONSOR_LOGO_BUCKET, SPONSOR_LOGO_MAX_BYTES } from '../src/lib/sponsor-logo'

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

function deleteRequest(url: string): NextRequest {
  return {
    url,
    headers: { get: () => null },
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

  it('JSON PUT persists has_stand', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', has_stand: true }, error: null })

    const res = await PUT(jsonRequest({ id: 's1', name: 'Acme', image_url: OLD_URL, has_stand: true }))

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].has_stand).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('multipart PUT reads has_stand from form fields', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', has_stand: true }, error: null })

    const res = await PUT(formRequest(null, { id: 's1', name: 'Acme', has_stand: 'true' }))

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0].has_stand).toBe(true)
  })

  it('JSON PUT defaults has_stand to false when omitted', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: OLD_URL }, error: null })
    singleUpdate.mockResolvedValue({ data: { id: 's1', has_stand: false }, error: null })

    const res = await PUT(jsonRequest({ id: 's1', name: 'Acme', image_url: OLD_URL }))

    expect(res.status).toBe(200)
    expect(update.mock.calls[0][0].has_stand).toBe(false)
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

describe('POST /api/admin/sponsors', () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

  let upload: jest.Mock
  let remove: jest.Mock
  let insert: jest.Mock
  let insertSingle: jest.Mock
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
    insert = jest.fn()
    insertSingle = jest.fn()
    const chain = {
      insert: jest.fn((payload: object) => {
        insert(payload)
        return { select: jest.fn(() => ({ single: insertSingle })) }
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

  it('multipart POST rejects an unsupported extension server-side', async () => {
    const res = await POST(formRequest({ name: 'logo.gif', size: 10, type: 'image/gif' }, { name: 'Acme' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Formato immagine non supportato. Usa PNG, JPG, JPEG, WEBP o SVG' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('multipart POST rejects a file larger than 5MB server-side', async () => {
    const res = await POST(
      formRequest({ name: 'logo.png', size: SPONSOR_LOGO_MAX_BYTES + 1, type: 'image/png' }, { name: 'Acme' }),
    )

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Immagine troppo grande (max 5MB)' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('multipart POST removes the uploaded logo when the insert fails', async () => {
    upload.mockResolvedValue({ data: { path: 'sponsors/uploaded.png' }, error: null })
    insertSingle.mockResolvedValue({ data: null, error: { message: 'DB fail' } })

    const res = await POST(formRequest({ name: 'logo.png', size: 10, type: 'image/png' }, { name: 'Acme' }))

    expect(res.status).toBe(500)
    expect(remove).toHaveBeenCalledTimes(1)
    const removed = remove.mock.calls[0][0] as string[]
    expect(removed).toHaveLength(1)
    expect(removed[0]).toMatch(/^sponsors\/[0-9a-f-]+\.png$/)
    expect(supabase.storage.from).toHaveBeenCalledWith(SPONSOR_LOGO_BUCKET)
  })

  it('multipart POST persists has_stand from form fields', async () => {
    upload.mockResolvedValue({ data: { path: 'sponsors/uploaded.png' }, error: null })
    insertSingle.mockResolvedValue({ data: { id: 's1', has_stand: true }, error: null })

    const res = await POST(formRequest({ name: 'logo.png', size: 10, type: 'image/png' }, { name: 'Acme', has_stand: 'true' }))

    expect(res.status).toBe(200)
    expect(insert.mock.calls[0][0].has_stand).toBe(true)
  })
})

describe('DELETE /api/admin/sponsors', () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

  let singleSelect: jest.Mock
  let remove: jest.Mock
  let supabase: ReturnType<typeof buildSupabase>

  afterAll(() => {
    if (ORIGINAL_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL
    }
  })

  function buildSupabase() {
    singleSelect = jest.fn()
    remove = jest.fn(async () => ({ error: null }))
    const chain = {
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: singleSelect })) })),
      delete: jest.fn(() => ({ eq: jest.fn(async () => ({ error: null })) })),
    }
    return {
      storage: { from: jest.fn().mockReturnValue({ remove }) },
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

  const STORED_URL = `${BASE}/storage/v1/object/public/sponsor-logos/sponsors/stored.png`

  it('DELETE removes the stored logo', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: STORED_URL }, error: null })

    const res = await DELETE(deleteRequest('https://example.com/api/admin/sponsors?id=s1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove.mock.calls[0][0]).toEqual(['sponsors/stored.png'])
    expect(supabase.storage.from).toHaveBeenCalledWith(SPONSOR_LOGO_BUCKET)
  })

  it('DELETE leaves external URLs untouched', async () => {
    singleSelect.mockResolvedValue({ data: { image_url: 'https://example.com/logo.png' }, error: null })

    const res = await DELETE(deleteRequest('https://example.com/api/admin/sponsors?id=s1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(remove).not.toHaveBeenCalled()
  })
})
