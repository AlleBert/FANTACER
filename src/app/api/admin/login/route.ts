import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 })
    }

    if (!adminUser.auth_id) {
      await supabase
        .from('admin_users')
        .update({ auth_id: authData.user.id })
        .eq('id', adminUser.id)
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email: authData.user.email }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  return NextResponse.json({ valid: true, email: user.email })
}