import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sponsors')
    .select('*')
    .order('sort_order', { ascending: true })

  return NextResponse.json({ data, pagination: { page: 1, limit: 100, total: data?.length || 0, pages: 1 } })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { name, image_url, website_url, is_active, sort_order } = body

  if (!name) {
    return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sponsors')
    .insert({ name, image_url, website_url, is_active, sort_order })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()
  const { id, name, image_url, website_url, is_active, sort_order } = body

  if (!id) {
    return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sponsors')
    .update({ name, image_url, website_url, is_active, sort_order, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID obbligatorio' }, { status: 400 })
  }

  const { error } = await supabase.from('sponsors').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
