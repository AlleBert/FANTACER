import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { factorId, challengeId, code } = await request.json()

    if (!factorId || !challengeId || !code) {
      return NextResponse.json({ error: 'factorId, challengeId e code richiesti' }, { status: 400 })
    }

    // AAL1 allowed at entry; verify() promotes the session to AAL2.
    await requireAdmin(request, { minAal: 'aal1' })

    const supabase = await createClient()
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })

    if (error || data === null) {
      console.error('MFA verify error:', error)
      return NextResponse.json({ error: 'Codice non valido' }, { status: 400 })
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