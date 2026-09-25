import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'
import { keyringFromEnv, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session-identity'
import { resolveSession, revokeSession } from '@/lib/session-identity-server'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'

/**
 * C06 — Revoca della sessione.
 *
 * Richiede un cookie di sessione **valido** + CSRF session-bound. Revoca la
 * riga e cancella il cookie (`Max-Age=0`).
 *
 * Idempotenza: se il cookie è presente ma la sessione è già revocata/scaduta
 * (`resolveSession` → null) la rotta risponde `200 { ok:true }` e pulisce il
 * cookie, senza toccare il DB. Il branch di no-op **non** richiede CSRF: non
 * c'è alcuno stato a cui applicarlo (sessione già invalida) e non è un logout
 * forzabile su una sessione valida (quella passa dal controllo CSRF).
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

    const clearCookie = (response: NextResponse) => {
      response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
    }

    // Idempotente: cookie presente ma sessione già invalida → no-op.
    if (!session) {
      const response = NextResponse.json({ ok: true }, { headers: noStore })
      clearCookie(response)
      return response
    }

    const csrf = verifyCsrfForRequest(request, keyring, session)
    if (!csrf.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStore })
    }

    const revoked = await revokeSession(admin, session.sessionId, 'user')
    if (!revoked) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
    }

    const response = NextResponse.json({ ok: true }, { headers: noStore })
    clearCookie(response)
    return response
  } catch (error) {
    console.error('identity revoke error:', error)
    return NextResponse.json({ error: 'identity unavailable' }, { status: 503, headers: noStore })
  }
}
