import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const isVotingBypassEnabled = () => process.env.X7K2M9QS3P === 'hx7k2m9Qs3P'

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
    const { company_id, fingerprint, turnstile_token, metadata } = body

    if (!company_id || !fingerprint) {
      console.error('API Vota: Missing fields', { company_id, fingerprint })
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
    }

    // 4. Verify Turnstile
    if (!turnstile_token) {
      console.error('API Vota: Token Turnstile mancante')
      return NextResponse.json({ error: 'Verifica di sicurezza mancante' }, { status: 400 })
    }

    const isBypass = isVotingBypassEnabled()
    const isBypassToken = turnstile_token === 'debug-bypass-token'
    
    let isHuman = false
    if (isBypass && isBypassToken) {
      console.log('API Vota: Bypassing Turnstile verification (DEV MODE)')
      isHuman = true
    } else {
      isHuman = await verifyTurnstile(turnstile_token, ip)
    }

    if (!isHuman) {
      console.error('API Vota: Verifica Turnstile fallita per il token fornito')
      return NextResponse.json({ error: 'Verifica di sicurezza fallita. Ricarica la pagina.' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Enhanced user-agent capture (try multiple headers for better device detection)
    const userAgent = request.headers.get('user-agent') || ''
    const secChUa = request.headers.get('sec-ch-ua') || ''
    const secChUaMobile = request.headers.get('sec-ch-ua-mobile') || ''
    const secChUaPlatform = request.headers.get('sec-ch-ua-platform') || ''
    
    // Build enhanced device info
    const enhancedUserAgent = userAgent || 
      (secChUaPlatform && secChUaMobile ? `${secChUaPlatform}; ${secChUaMobile}` : '') ||
      'Unknown'
    
    // 5. Submit vote via RPC (Atomic & Secured)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_vote', {
      company_id_param: company_id,
      fingerprint_param: fingerprint,
      ip_param: ip,
      user_agent_param: enhancedUserAgent,
      country_param: country
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (rpcResult && !rpcResult.success) {
      console.warn('API Vota: RPC rejected vote', rpcResult.error)
      return NextResponse.json({ error: rpcResult.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}