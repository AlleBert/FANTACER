import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const enabled = body.enabled === true

    const { error: updateError } = await supabase
      .from('site_settings')
      .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('key', 'coming_soon_enabled')

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Failed to update coming_soon_enabled:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ enabled: false }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (error || !user) {
      return NextResponse.json({ enabled: false }, { status: 401 })
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single()
    if (!adminUser) {
      return NextResponse.json({ enabled: false }, { status: 401 })
    }

    const { data, error: readError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single()

    if (readError) throw readError
    return NextResponse.json({ enabled: data.value === 'true' })
  } catch (e) {
    console.error('Failed to read coming_soon_enabled:', e)
    return NextResponse.json({ enabled: false })
  }
}
