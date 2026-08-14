import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toAdminError } from '@/lib/admin-auth'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()
    const { data: adminUser } = await adminSupabase
      .from('admin_users')
      .select('id, role, mfa_verified_at')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminUser) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    // Get verified factors
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const verifiedFactors = (factorsData?.all || []).filter(f => f.status === 'verified')

    if (verifiedFactors.length === 0) {
      return NextResponse.json({ factorId: null, mfaExpired: false })
    }

    // Check if MFA is expired (24h)
    const MFA_VALIDITY_MS = 24 * 60 * 60 * 1000
    const mfaVerifiedAt = adminUser.mfa_verified_at
    let mfaExpired = false

    if (!mfaVerifiedAt) {
      mfaExpired = true
    } else {
      const verifiedTime = new Date(mfaVerifiedAt).getTime()
      const now = Date.now()
      mfaExpired = (now - verifiedTime) > MFA_VALIDITY_MS
    }

    return NextResponse.json({
      factorId: verifiedFactors[0].id,
      mfaExpired,
      role: adminUser.role,
    })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}
