import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Value "0.0.0.0"/"::1" → localhost; Next 16 `proxy.ts` sets
 * `x-forwarded-for` when behind a CDN/proxy.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const cf = request.headers.get('cf-connecting-ip')
  const ip = cf || (forwarded ? forwarded.split(',')[0].trim() : '')
  if (!ip || ip === 'unknown') return request.headers.get('x-real-ip') || '0.0.0.0'
  return ip
}

/**
 * DB-backed sliding-window rate limit (RPC `check_rate_limit`).
 * `key` should compose IP + account to avoid lockout storms on shared IPs.
 *
 * Returns `false` when the limit is hit. Use for auth-sensitive routes
 * (login, MFA verify).
 */
export async function checkRateLimit(
  key: string,
  windowMs = 15 * 60 * 1000,
  maxRequests = 10,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('check_rate_limit', {
    ip_param: key,
    window_ms: windowMs,
    max_requests: maxRequests,
  })

  if (error) {
    console.error('Rate limit check error:', error.message)
    return true // fail-open only on infra errors, not on limit hits
  }

  return data === true
}