import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { factorId } = await request.json()

    if (!factorId) {
      return NextResponse.json({ error: 'factorId richiesto' }, { status: 400 })
    }

    // Session already at AAL1 (post-password). No AAL2 yet.
    await requireAdmin(request, { minAal: 'aal1' })

    const supabase = await createClient()
    const { data, error } = await supabase.auth.mfa.challenge({ factorId })

    if (error || !data) {
      console.error('MFA challenge error:', error)
      return NextResponse.json({ error: 'Challenge non valida' }, { status: 400 })
    }

    return NextResponse.json({ challengeId: data.id, expiresAt: data.expires_at })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}