import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  try {
    // AAL1 enough to sign out; the dashboard route itself needs AAL2 anyway.
    const { user } = await requireAdmin(request, { minAal: 'aal1' })

    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json({ error: 'Errore logout' }, { status: 500 })
    }

    await writeAuditEvent({
      eventType: 'admin_logout',
      ipAddress: ip,
      userAgent,
      metadata: { email: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}