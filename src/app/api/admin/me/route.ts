import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin(request)
    return NextResponse.json({ email: ctx.user.email, role: ctx.role })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}