import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTrustedClientIp } from '@/lib/request-ip'

/**
 * IP client attendibile, oppure `null` se non esiste evidenza affidabile.
 * Unica fonte: `getTrustedClientIp` (cf-connecting-ip + cf-ray). Mai un
 * valore condiviso tipo `0.0.0.0`.
 */
export function getClientIp(request: NextRequest): string | null {
  return getTrustedClientIp(request).ip
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