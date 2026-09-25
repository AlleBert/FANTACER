import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'
import { keyringFromEnv, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session-identity'
import { resolveSession, renewSession } from '@/lib/session-identity-server'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'

/**
 * C06 — Rinnovo della sessione (rotazione token + CSRF).
 *
 * Rotta **session-based**: richiede un cookie di sessione valido, non ne crea
 * mai uno nuovo. La sessione è l'autorità, quindi la rotta è protetta da CSRF
 * session-bound (`X-CSRF-Token` + Origin/Host same-origin).
 *
 * `renewSession` preserva la **scadenza assoluta**: il nuovo cookie viene
 * emesso con `max-age` pari alla vita residua, non alle 12h piene. Ruotare il
 * token non estende il cap assoluto.
 *
 * Rate limit pre-sessione su IP attendibile pseudonimizzato (stessa semantica
 * `observe`/`enforce` del bootstrap): senza IP attendibile o HMAC ⇒ fail-closed.
 */
export async function POST(request: NextRequest) {
  const noStore = { 'Cache-Control': 'no-store' }
  try {
    const ipSignal = getTrustedClientIp(request)
    const ipHash = ipSignal.ip ? hmacIp(ipSignal.ip) : null
    if (!ipSignal.ip || !ipHash) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
    }

    const rate = await evaluateBootstrapRateLimit({ ipHash })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'rate limited' },
        { status: 429, headers: { ...noStore, 'Retry-After': String(rate.retryAfterSec) } },
      )
    }

    const keyring = keyringFromEnv()
    if (!keyring) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
    }

    const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? null
    if (!cookie) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore })
    }

    const admin = createAdminClient()
    const session = await resolveSession(admin, cookie, keyring)
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore })
    }

    const csrf = verifyCsrfForRequest(request, keyring, session)
    if (!csrf.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore })
    }

    const renewed = await renewSession(admin, cookie, keyring)
    if (!renewed) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
    }

    // Vita assoluta residua (cap non estendibile): il nuovo cookie scade
    // esattamente con la sessione, non 12h da adesso.
    const remainingSec = Math.max(
      0,
      Math.floor((new Date(renewed.expiresAt).getTime() - Date.now()) / 1000),
    )

    const response = NextResponse.json({ ok: true, csrfToken: renewed.csrfToken }, { headers: noStore })
    response.cookies.set(SESSION_COOKIE, renewed.cookieValue, sessionCookieOptions(remainingSec))
    return response
  } catch (error) {
    console.error('identity renew error:', error)
    return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
  }
}
