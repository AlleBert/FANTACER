import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/supabase/vote-api'

const isVotingBypassEnabled = () => process.env.NEXT_PUBLIC_X7K2M9QS3P === 'hx7k2m9Qs3P'

// Geo blocking: Italia + EU
const ALLOWED_COUNTRIES = ['IT', 'DE', 'FR', 'ES', 'PT', 'AT', 'BE', 'NL', 'SI', 'HR', 'MT', 'CY', 'GR', 'GB', 'IE', 'PL', 'CZ', 'HU', 'SK', 'RO', 'BG', 'SE', 'FI', 'DK', 'NO']

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string, windowMs = 3600000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count > 100) return false
  record.count++
  return true
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return true

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`
  })

  const outcome = await response.json()
  return outcome.success
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown'
    
    // 1. Rate limiting
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 } )
    }

    // 2. Geo blocking
    const country = request.headers.get('cf-ipcountry') || 'IT'
    if (!ALLOWED_COUNTRIES.includes(country)) {
      return NextResponse.json({ error: 'Access denied from your region' }, { status: 403 })
    }

    // 3. Parse body
    const body = await request.json()
    const { companyId, fingerprint, turnstile_token, comment, adjective, sliders } = body

    // Validate required fields
    if (!companyId || !fingerprint || !comment || !adjective || !sliders) {
      console.error('API Vota: Missing fields', { companyId, fingerprint, comment, adjective, sliders })
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
    }

    // Validate adjective
    const validAdjectives = ['eccezionale', 'migliore', 'nella media', 'peggiore'] as const
    if (!validAdjectives.includes(adjective)) {
      return NextResponse.json({ error: 'Adjective non valido' }, { status: 400 })
    }

    // Validate sliders structure and values
    const requiredSliderKeys = ['innovation', 'sales', 'wow'] as const
    for (const key of requiredSliderKeys) {
      const value = sliders[key]
      if (typeof value !== 'number' || value < 0 || value > 100) {
        return NextResponse.json({ error: `Slider ${key} non valido (deve essere 0-100)` }, { status: 400 })
      }
    }

    // 4. Verify Turnstile
    if (!turnstile_token) {
      console.error('API Vota: Token Turnstile mancante')
      return NextResponse.json({ error: 'Verifica di sicurezza mancante' }, { status: 400 })
    }

    const isBypass = isVotingBypassEnabled()
    const isBypassToken = turnstile_token === 'debug-bypass-token'
    
    let isHuman = false
    // DEV BYPASS DISABLED FOR TESTING
    // if (isBypass && isBypassToken) {
    //   console.log('API Vota: Bypassing Turnstile verification (DEV MODE)')
    //   isHuman = true
    // } else {
      isHuman = await verifyTurnstile(turnstile_token, ip)
    // }

    if (!isHuman) {
      console.error('API Vota: Verifica Turnstile fallita per il token fornito')
      return NextResponse.json({ error: 'Verifica di sicurezza fallita. Ricarica la pagina.' }, { status: 400 })
    }

    // Enhanced user-agent capture (try multiple headers for better device detection)
    const userAgent = request.headers.get('user-agent') || ''
    const secChUa = request.headers.get('sec-ch-ua') || ''
    const secChUaMobile = request.headers.get('sec-ch-ua-mobile') || ''
    const secChUaPlatform = request.headers.get('sec-ch-ua-platform') || ''
    
    // Build enhanced device info
    const enhancedUserAgent = userAgent || 
      (secChUaPlatform && secChUaMobile ? `${secChUaPlatform}; ${secChUaMobile}` : '') ||
      'Unknown'
    
    // 5. Submit vote via submitVote
    const voteSubmission = {
      companyId,
      fingerprint,
      ip,
      userAgent: enhancedUserAgent,
      country,
      comment,
      adjective,
      sliders,
    }

    const { success, error: submitError } = await submitVote(voteSubmission)

    if (!success) {
      // Check if it's a duplicate vote (user already voted today)
      if (submitError?.includes('Hai già votato oggi')) {
        return NextResponse.json({ error: submitError }, { status: 409 })
      }
      // Other client errors (invalid data, etc.)
      if (submitError) {
        return NextResponse.json({ error: submitError }, { status: 400 })
      }
      return NextResponse.json({ error: 'Vote rejected' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}