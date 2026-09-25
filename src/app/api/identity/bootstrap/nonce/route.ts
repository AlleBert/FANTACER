import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createBootstrapNonce,
  countOutstandingBootstrapNonces,
  bootstrapNonceMaxOutstanding,
  BOOTSTRAP_NONCE_TTL_MS,
} from '@/lib/bootstrap-nonce'
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
 * Fail-closed: senza IP attendibile (o HMAC/IP counting non disponibile) la
 * richiesta è rifiutata con 503, non si salta il rate limit. Un cap per bucket
 * IP limita i nonce in sospeso. La risposta non è mai cacheabile (`no-store`).
 */
function jsonNoStore(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(headers ?? {}) },
  })
}

export async function GET(request: NextRequest) {
  if (sessionIdentityMode() === 'off') {
    return jsonNoStore({ ok: false }, 404)
  }

  try {
    const ipSignal = getTrustedClientIp(request)
    const ipHash = ipSignal.ip ? hmacIp(ipSignal.ip) : null
    if (!ipSignal.ip || !ipHash) {
      return jsonNoStore({ error: 'identity unavailable' }, 503)
    }

    const rate = await evaluateBootstrapRateLimit({ ipHash })
    if (!rate.allowed) {
      return jsonNoStore({ error: 'Too many requests' }, 429, {
        'Retry-After': String(rate.retryAfterSec),
      })
    }

    const admin = createAdminClient()

    const outstanding = await countOutstandingBootstrapNonces(admin, ipHash)
    if (outstanding === null) {
      return jsonNoStore({ error: 'identity unavailable' }, 503)
    }
    if (outstanding >= bootstrapNonceMaxOutstanding()) {
      return jsonNoStore({ error: 'Too many outstanding nonces' }, 429, {
        'Retry-After': String(Math.ceil(BOOTSTRAP_NONCE_TTL_MS / 1000)),
      })
    }

    const issued = await createBootstrapNonce(admin, ipHash)
    if (!issued) {
      return jsonNoStore({ error: 'identity unavailable' }, 503)
    }

    return jsonNoStore(issued)
  } catch (error) {
    console.error('identity bootstrap nonce error:', error)
    return jsonNoStore({ error: 'Internal server error' }, 500)
  }
}
