import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'

const ERROR = (status: number) =>
  status === 401 ? 'Non autorizzato' : 'Accesso negato'

export async function PUT(request: NextRequest) {
  try {
    await requireRoleAdmin(request)

    const body = await request.json()
    const enabled = body.enabled === true

    const supabase = createAdminClient()
    const { error: updateError } = await supabase
      .from('site_settings')
      .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('key', 'voting_enabled')
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) return NextResponse.json({ error: ERROR(status) }, { status })
    console.error('Errore aggiornamento voting_enabled:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const supabase = createAdminClient()
    const { data, error: readError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'voting_enabled')
      .single()
    
    // Se il record non esiste, default a true (votazioni attive)
    if (readError) {
      if (readError.code === 'PGRST116') {
        return NextResponse.json({ enabled: true })
      }
      throw readError
    }

    return NextResponse.json({ enabled: data.value === 'true' })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) return NextResponse.json({ error: ERROR(status) }, { status })
    console.error('Errore lettura voting_enabled:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
