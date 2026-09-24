import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBootstrapNonce } from '@/lib/bootstrap-nonce'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'
import { sessionIdentityMode } from '@/lib/session-identity-server'

/**
 * P0-4c — Emissione nonce di bootstrap (pre-sessione, pubblico).
 *
 * Endpoint pubblico senza PII: restituisce `{ nonce, cData }` da passare al
 * widget Turnstile come `data-cdata`. Rate-limited per IP attendibile
 * pseudonimizzato (modalità `observe`|`enforce` via `BOOTSTRAP_RATE_LIMIT_MODE`).
 *
 * Non richiede admin: la sicurezza è data dal rate limit + dalla monouso del
 * nonce + dalla verifica Turnstile action `bootstrap` al POST.
 */
export async function GET(request: NextRequest) {
  if (sessionIdentityMode() === 'off') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  try {
    const ipSignal = getTrustedClientIp(request)
    const ipHash = ipSignal.ip ? hmacIp(ipSignal.ip) : null
    if (ipSignal.ip && !ipHash) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const rate = await evaluateBootstrapRateLimit({ ipHash })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
      )
    }

    const admin = createAdminClient()
    const issued = await createBootstrapNonce(admin)
    if (!issued) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    return NextResponse.json(issued)
  } catch (error) {
    console.error('identity bootstrap nonce error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
