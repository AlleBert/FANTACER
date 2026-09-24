import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstile } from '@/lib/turnstile'
import { consumeBootstrapNonce, verifyBootstrapCData } from '@/lib/bootstrap-nonce'
import { evaluateBootstrapRateLimit } from '@/lib/bootstrap-rate-limit'
import { getTrustedClientIp, hmacIp } from '@/lib/request-ip'
import { resolveVoterKey } from '@/lib/vote-identity-server'
import { resolveVoteFingerprint } from '@/lib/vote-dev-bypass'
import { keyringFromEnv, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session-identity'
import {
  sessionIdentityMode,
  getActiveEvent,
  resolveOrCreatePrincipal,
  createSession,
} from '@/lib/session-identity-server'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

/**
 * P0-4b/c — Bootstrap sessione server-side.
 *
 * Richiede Turnstile con action `bootstrap` e `cData` legata a un nonce
 * monouso emesso da `GET /api/identity/bootstrap/nonce` (P0-4c). Il nonce è
 * consumato **prima** di creare la sessione: senza un nonce valido non nasce
 * mai una nuova identità. Rate limit pre-sessione su IP attendibile.
 *
 * Aggancia il browser al **suo** principal usando il fingerprint legacy (cookie
 * first-party), così chi ha già votato mantiene l'identità. Nessun `voterId`
 * dal payload.
 */
export async function POST(request: NextRequest) {
  const mode = sessionIdentityMode()
  if (mode === 'off') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const locale = resolveLocale(
    request.headers.get('accept-language'),
    request.cookies.get(LOCALE_COOKIE)?.value ?? null,
  )
  const err = (key: Parameters<typeof translate>[1]) => translate(locale, key)

  try {
    // P0-4c: rate limit per primo, su IP attendibile pseudonimizzato.
    // Senza IP attendibile o HMAC non disponibile ⇒ fail-closed (503), mai
    // saltare il rate limit.
    const ipSignal = getTrustedClientIp(request)
    const ipHash = ipSignal.ip ? hmacIp(ipSignal.ip) : null
    if (!ipSignal.ip || !ipHash) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const rate = await evaluateBootstrapRateLimit({ ipHash })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: err('voteError.rateLimited') },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
      )
    }

    const keyring = keyringFromEnv()
    if (!keyring) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const turnstile = body?.turnstile_token
    const cData = body?.cData
    if (!turnstile || typeof cData !== 'string' || cData.length === 0) {
      return NextResponse.json({ error: err('voteError.missingSecurity') }, { status: 400 })
    }

    // Turnstile vincolata all'action `bootstrap` e al `cData` atteso.
    const verification = await verifyTurnstile(turnstile, { action: 'bootstrap', cData })
    if (!verification.ok) {
      return NextResponse.json({ error: err('voteError.securityFailed') }, { status: 400 })
    }

    // cData nel formato `bootstrap:<nonce>`: altrimenti richiesta malformata.
    const nonce = verifyBootstrapCData(cData)
    if (!nonce) {
      return NextResponse.json({ error: err('voteError.securityFailed') }, { status: 400 })
    }

    const admin = createAdminClient()

    // Monouso, atomico. Errore DB ⇒ 503; non valido/scaduto/già usato ⇒ 403.
    const consumed = await consumeBootstrapNonce(admin, nonce)
    if (consumed === 'error') {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }
    if (consumed !== 'consumed') {
      return NextResponse.json({ error: err('voteError.securityFailed') }, { status: 403 })
    }

    // Identità legacy dal solo cookie first-party (nessun payload).
    const resolved = resolveVoterKey(request, undefined)
    if (!resolved) {
      return NextResponse.json({ error: err('voteError.missingVoterId') }, { status: 400 })
    }

    const event = await getActiveEvent(admin)
    if (!event) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const fingerprint = resolveVoteFingerprint(resolved.key)
    const principalId = await resolveOrCreatePrincipal(admin, event.id, fingerprint)
    if (!principalId) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const session = await createSession(admin, event.id, principalId, keyring)
    if (!session) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const response = NextResponse.json({ ok: true, csrfToken: session.csrfToken })
    response.cookies.set(SESSION_COOKIE, session.cookieValue, sessionCookieOptions())
    return response
  } catch (error) {
    console.error('identity bootstrap error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
