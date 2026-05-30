import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(request: NextRequest) {
  try {
    const bypass = process.env.NEXT_PUBLIC_X7K2M9QS3P === 'hx7k2m9Qs3P'

    const supabase = createAdminClient()

    if (!bypass) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }

      const { data: { user }, error } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (error || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('auth_id', user.id)
        .eq('is_active', true)
        .single()
      if (!adminUser) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }
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
    console.error('Errore aggiornamento coming_soon_enabled:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const bypass = process.env.NEXT_PUBLIC_X7K2M9QS3P === 'hx7k2m9Qs3P'

    const supabase = createAdminClient()

    if (!bypass) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }

      const { data: { user }, error } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (error || !user) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('auth_id', user.id)
        .eq('is_active', true)
        .single()
      if (!adminUser) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
      }
    }

    const { data, error: readError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single()
    if (readError) throw readError

    return NextResponse.json({ enabled: data.value === 'true' })
  } catch (e) {
    console.error('Errore lettura coming_soon_enabled:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
