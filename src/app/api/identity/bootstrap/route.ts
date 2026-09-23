import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstile } from '@/lib/turnstile'
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
 * P0-4b — Bootstrap sessione server-side.
 *
 * Richiede Turnstile (fail-closed). Aggancia il browser al **suo** principal
 * usando il fingerprint legacy (cookie first-party), così chi ha già votato
 * mantiene l'identità. Nessun `voterId` dal payload.
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
    const keyring = keyringFromEnv()
    if (!keyring) {
      return NextResponse.json({ error: 'identity unavailable' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const turnstile = body?.turnstile_token
    if (!turnstile) {
      return NextResponse.json({ error: err('voteError.missingSecurity') }, { status: 400 })
    }

    const verification = await verifyTurnstile(turnstile)
    if (!verification.ok) {
      return NextResponse.json({ error: err('voteError.securityFailed') }, { status: 400 })
    }

    // Identità legacy dal solo cookie first-party (nessun payload).
    const resolved = resolveVoterKey(request, undefined)
    if (!resolved) {
      return NextResponse.json({ error: err('voteError.missingVoterId') }, { status: 400 })
    }

    const admin = createAdminClient()
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

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, session.cookieValue, sessionCookieOptions())
    return response
  } catch (error) {
    console.error('identity bootstrap error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
