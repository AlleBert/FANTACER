import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@fantacer.it'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fantacer2024'

const sessions = new Map<string, { email: string; expires: number }>()

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    // Verify credentials from env
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex')
    sessions.set(sessionToken, {
      email,
      expires: Date.now() + 8 * 60 * 60 * 1000
    })

    return NextResponse.json({ sessionToken })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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