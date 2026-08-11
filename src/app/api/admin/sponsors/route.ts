import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import {
  SPONSOR_LOGO_BUCKET,
  SPONSOR_LOGO_MAX_BYTES,
  buildLogoPath,
  getExtFromFilename,
  getPublicLogoUrl,
  isBucketUrl,
  extractPathFromUrl,
} from '@/lib/sponsor-logo'

type AdminClient = ReturnType<typeof createAdminClient>

const FILE_TYPE_MSG = 'Formato immagine non supportato. Usa PNG, JPG, JPEG, WEBP o SVG'
const FILE_SIZE_MSG = 'Immagine troppo grande (max 5MB)'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function uploadLogo(
  supabase: AdminClient,
  file: File,
): Promise<{ url: string } | { error: NextResponse }> {
  const ext = getExtFromFilename(file.name)
  if (!ext) return { error: jsonError(FILE_TYPE_MSG, 400) }
  if (file.size > SPONSOR_LOGO_MAX_BYTES) return { error: jsonError(FILE_SIZE_MSG, 400) }

  const path = buildLogoPath(crypto.randomUUID(), ext)
  const { error } = await supabase.storage
    .from(SPONSOR_LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return { error: jsonError(error.message, 500) }
  return { url: getPublicLogoUrl(path) }
}

async function removeStoredLogo(supabase: AdminClient, imageUrl: string | null) {
  if (!imageUrl || !isBucketUrl(imageUrl)) return
  const path = extractPathFromUrl(imageUrl)
  if (path) {
    try {
      await supabase.storage.from(SPONSOR_LOGO_BUCKET).remove([path])
    } catch {
      // best-effort: il record è già salvato, non bloccare la risposta
    }
  }
}

function isMultipart(request: NextRequest): boolean {
  return (request.headers.get('content-type') ?? '').includes('multipart/form-data')
}

async function parseForm(
  request: NextRequest,
): Promise<{ fields: Record<string, FormDataEntryValue | null>; file: File | null }> {
  const form = await request.formData()
  const get = (k: string) => (form.has(k) ? form.get(k) : null)
  const file = form.get('file') as File | null
  return {
    fields: {
      id: get('id'),
      name: get('name'),
      website_url: get('website_url'),
      is_active: get('is_active'),
      sort_order: get('sort_order'),
    },
    file: file && file.size > 0 ? file : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('sponsors')
      .select('*')
      .order('sort_order', { ascending: true })

    return NextResponse.json({ data, pagination: { page: 1, limit: 100, total: data?.length || 0, pages: 1 } })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const supabase = createAdminClient()

    let name: string | null = null
    let image_url: string | null = null
    let website_url: string | null = null
    let is_active = true
    let sort_order = 0

    if (isMultipart(request)) {
      const { fields, file } = await parseForm(request)
      name = String(fields.name ?? '')
      website_url = (fields.website_url as string) || null
      is_active = fields.is_active !== 'false'
      sort_order = Number(fields.sort_order ?? 0) || 0

      if (file) {
        const result = await uploadLogo(supabase, file)
        if ('error' in result) return result.error
        image_url = result.url
      }
    } else {
      const body = await request.json()
      name = body.name ?? null
      image_url = body.image_url ?? null
      website_url = body.website_url ?? null
      is_active = body.is_active ?? true
      sort_order = body.sort_order ?? 0
    }

    if (!name) {
      return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('sponsors')
      .insert({ name, image_url, website_url, is_active, sort_order })
      .select()
      .single()

    if (error) {
      await removeStoredLogo(supabase, image_url)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const supabase = createAdminClient()

    let id: string | null = null
    let name: string | null = null
    let image_url: string | null = null
    let website_url: string | null = null
    let is_active = true
    let sort_order = 0
    let newImageUrl: string | null = null

    if (isMultipart(request)) {
      const { fields, file } = await parseForm(request)
      id = (fields.id as string) || null
      name = String(fields.name ?? '')
      website_url = (fields.website_url as string) || null
      is_active = fields.is_active !== 'false'
      sort_order = Number(fields.sort_order ?? 0) || 0

      if (file) {
        const result = await uploadLogo(supabase, file)
        if ('error' in result) return result.error
        newImageUrl = result.url
      }
    } else {
      const body = await request.json()
      id = body.id ?? null
      name = body.name ?? null
      image_url = body.image_url ?? null
      website_url = body.website_url ?? null
      is_active = body.is_active ?? true
      sort_order = body.sort_order ?? 0
    }

    if (!id) {
      return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('sponsors')
      .select('image_url')
      .eq('id', id)
      .single()

    const finalImageUrl = newImageUrl ?? image_url ?? existing?.image_url ?? null

    const { data, error } = await supabase
      .from('sponsors')
      .update({ name, image_url: finalImageUrl, website_url, is_active, sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (newImageUrl) {
      await removeStoredLogo(supabase, existing?.image_url ?? null)
    }

    return NextResponse.json(data)
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('sponsors')
      .select('image_url')
      .eq('id', id)
      .single()

    const { error } = await supabase.from('sponsors').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await removeStoredLogo(supabase, existing?.image_url ?? null)

    return NextResponse.json({ success: true })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
  }
}
