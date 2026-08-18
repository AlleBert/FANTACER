import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminRole } from '@/lib/admin-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditEvent } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  try {
    // Rate limit per IP+email: brute force on the admin login.
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    const key = `admin:login:${ip}:${String(email).toLowerCase()}`
    const allowed = await checkRateLimit(key, 15 * 60 * 1000, Number(process.env.ADMIN_LOGIN_RATE_MAX ?? 10))
    if (!allowed) {
      await writeAuditEvent({
        eventType: 'admin_login_ratelimited',
        ipAddress: ip,
        userAgent,
        metadata: { email },
      })
      return NextResponse.json(
        { error: 'Troppi tentativi. Riprova più tardi.' },
        { status: 429 },
      )
    }

    // 1. Admin authorization (service role read — no session yet)
    const adminSupabase = createAdminClient()
    const { data: adminUser } = await adminSupabase
      .from('admin_users')
      .select('id, auth_id, role')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (!adminUser) {
      await writeAuditEvent({
        eventType: 'admin_login_failed',
        ipAddress: ip,
        userAgent,
        metadata: { email },
      })
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // 2. Password authentication → AAL1 session (cookies set by @supabase/ssr)
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      await writeAuditEvent({
        eventType: 'admin_login_failed',
        ipAddress: ip,
        userAgent,
        metadata: { email },
      })
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // 3. Link auth_id if missing or stale (e.g. auth user was re-provisioned
    //    with a new id). Self-heals the admin_users → auth.users relationship
    //    so requireAdmin lookup by auth_id always resolves.
    if (adminUser.auth_id !== data.user.id) {
      await adminSupabase
        .from('admin_users')
        .update({ auth_id: data.user.id })
        .eq('email', email)
    }

    // 4. MFA: obbligatoria solo per role='admin' (aal2). I viewer restano
    // su AAL1 senza MFA; un admin senza factor verificato viene bloccato
    // esplicitamente (nessun redirect infinito sul login).
    const role: AdminRole = adminUser.role === 'viewer' ? 'viewer' : 'admin'
    const verifiedFactors = (data.user.factors || []).filter(
      (f) => f.status === 'verified',
    )

    if (role === 'admin' && verifiedFactors.length === 0) {
      await writeAuditEvent({
        eventType: 'admin_login_mfa_missing',
        ipAddress: ip,
        userAgent,
        metadata: { email },
      })
      return NextResponse.json(
        {
          error:
            'MFA non configurato. Ri-esegui il provisioning: npm run provision:e2e:admin -- --force',
          code: 'mfa_not_configured',
        },
        { status: 403 },
      )
    }

    if (role === 'admin' && verifiedFactors.length > 0) {
      const factorId = verifiedFactors[0].id
      await writeAuditEvent({
        eventType: 'admin_login_password',
        ipAddress: ip,
        userAgent,
        metadata: { email, mfaRequired: true },
      })
      return NextResponse.json({
        success: true,
        mfaRequired: true,
        factorId,
        role,
      })
    }

    await writeAuditEvent({
      eventType: 'admin_login_success',
      ipAddress: ip,
      userAgent,
      metadata: { email },
    })

    return NextResponse.json({
      success: true,
      mfaRequired: false,
      role,
      user: { id: data.user.id, email: data.user.email },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}