import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Geo blocking: Italia + EU
const ALLOWED_COUNTRIES = ['IT', 'DE', 'FR', 'ES', 'PT', 'AT', 'BE', 'NL', 'SI', 'HR', 'MT', 'CY', 'GR', 'GB', 'IE', 'PL', 'CZ', 'HU', 'SK', 'RO', 'BG', 'SE', 'FI', 'DK', 'NO']

// Simple in-memory rate limiter (use Redis for production)
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

function checkDailyVote(supabase: any, fingerprint: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00Z`
  const endOfDay = `${today}T23:59:59Z`
  
  return supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .then(({ count }: { count: number }) => (count || 0) > 0)
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown'
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // 2. Geo blocking (simplified - in production use proper geo service)
    const country = request.headers.get('cf-ipcountry') || 'IT'
    if (!ALLOWED_COUNTRIES.includes(country)) {
      return NextResponse.json({ error: 'Access denied from your region' }, { status: 403 })
    }

    // 3. Parse body
    const body = await request.json()
    const { company_id, fingerprint, turnstile_token } = body

    if (!company_id || !fingerprint) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 4. Verify Turnstile (simplified - in production use proper verification)
    if (!turnstile_token) {
      return NextResponse.json({ error: 'Please complete the verification' }, { status: 400 })
    }

    // 5. Check daily vote
    const supabase = await createClient()
    const hasVoted = await checkDailyVote(supabase, fingerprint)
    
    if (hasVoted) {
      return NextResponse.json({ error: 'Hai già votato oggi' }, { status: 400 })
    }

    // 6. Insert vote
    const { data, error } = await supabase
      .from('votes')
      .insert({
        company_id,
        fingerprint,
        ip_hash: ip,
        user_agent: request.headers.get('user-agent') || '',
        country
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 7. Update daily stats
    const today = new Date().toISOString().split('T')[0]
    await supabase.rpc('increment_vote', { company_id_param: company_id, date_param: today })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}