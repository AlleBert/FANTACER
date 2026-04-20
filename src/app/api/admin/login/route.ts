import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Simple session store (use Redis in production)
const sessions = new Map<string, { email: string; expires: number }>()

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, mfaCode } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check admin user
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Verify password
    const passwordHash = hashPassword(password, admin.email)
    if (passwordHash !== admin.password_hash) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Check MFA if enabled
    if (admin.mfa_secret && !mfaCode) {
      return NextResponse.json({ requiresMfa: true }, { status: 200 })
    }

    if (admin.mfa_secret) {
      // Verify TOTP (simplified - use a proper TOTP library in production)
      const verificationCode = Math.floor(Date.now() / 30000) % 1000000
      if (mfaCode !== verificationCode.toString()) {
        return NextResponse.json({ error: 'Codice MFA non valido' }, { status: 401 })
      }
    }

    // IP check (whitelist)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip')
      || 'unknown'
    
    if (admin.ip_whitelist && !admin.ip_whitelist.includes(clientIp)) {
      return NextResponse.json({ error: 'Accesso non consentito da questo IP' }, { status: 403 })
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex')
    sessions.set(sessionToken, {
      email,
      expires: Date.now() + 8 * 60 * 60 * 1000 // 8 hours
    })

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id)

    return NextResponse.json({ sessionToken })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Session validation middleware
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const sessionToken = authHeader?.replace('Bearer ', '')

  if (!sessionToken) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const session = sessions.get(sessionToken)
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionToken)
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  return NextResponse.json({ valid: true, email: session.email })
}