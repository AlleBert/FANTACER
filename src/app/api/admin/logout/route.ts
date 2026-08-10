import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    // AAL1 enough to sign out; the dashboard route itself needs AAL2 anyway.
    await requireAdmin(request, { minAal: 'aal1' })

    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json({ error: 'Errore logout' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}