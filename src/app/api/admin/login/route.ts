import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit per IP+email: brute force on the admin login.
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    const key = `admin:login:${getClientIp(request)}:${String(email).toLowerCase()}`
    const allowed = await checkRateLimit(key, 15 * 60 * 1000, 10)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Troppi tentativi. Riprova più tardi.' },
        { status: 429 },
      )
    }

    // 1. Admin authorization (service role read — no session yet)
    const adminSupabase = createAdminClient()
    const { data: adminUser } = await adminSupabase
      .from('admin_users')
      .select('id, auth_id')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (!adminUser) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // 2. Password authentication → AAL1 session (cookies set by @supabase/ssr)
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // 3. Link auth_id if missing
    if (!adminUser.auth_id) {
      await adminSupabase
        .from('admin_users')
        .update({ auth_id: data.user.id })
        .eq('email', email)
    }

    // 4. MFA: verified TOTP factors → challenge requires AAL2
    const verifiedFactors = (data.user.factors || []).filter(
      (f) => f.status === 'verified',
    )
    if (verifiedFactors.length > 0) {
      const factorId = verifiedFactors[0].id
      return NextResponse.json({
        success: true,
        mfaRequired: true,
        factorId,
      })
    }

    return NextResponse.json({
      success: true,
      mfaRequired: false,
      user: { id: data.user.id, email: data.user.email },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}