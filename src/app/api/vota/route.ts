import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/supabase/vote-api'
import { getActiveBatch } from '@/lib/supabase/batch'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveVoteFingerprint } from '@/lib/vote-dev-bypass'
import { resolveVoterKey, applyVoterCookie } from '@/lib/vote-identity-server'
import { getAntibotEnabled, getFairEndState } from '@/lib/site-flags'
import { verifyTurnstile } from '@/lib/turnstile'
import { getTrustedClientIp, hmacIp, type ClientIpSignal } from '@/lib/request-ip'
import { recordIpSignal } from '@/lib/ip-signal-metrics'
import { evaluateVoteRateLimit } from '@/lib/vote-rate-limit'
import { logVoteRequestEnd, type VoteOutcome } from '@/lib/vote-telemetry'
import { keyringFromEnv, SESSION_COOKIE } from '@/lib/session-identity'
import {
  sessionIdentityMode,
  getActiveEvent,
  resolveOrCreatePrincipal,
  resolveSessionPrincipal,
  linkVoteToPrincipal,
} from '@/lib/session-identity-server'
import { romeDateKey } from '@/lib/admin-analytics'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

interface VoteTelemetry {
  outcome?: VoteOutcome
  status?: number
  rateMode?: 'observe' | 'enforce'
  rateWouldBlock?: boolean
  rateIpWouldBlock?: boolean
  rateIdWouldBlock?: boolean
  rateScopes?: { ip: boolean | null; id: boolean | null }
  ipSignal?: ClientIpSignal
  turnstileReason?: string | null
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const tel: VoteTelemetry = {}

  try {
    const locale = resolveLocale(
      request.headers.get('accept-language'),
      request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    )
    const err = (key: Parameters<typeof translate>[1]) => translate(locale, key)
    const ipSignal = getTrustedClientIp(request)
    recordIpSignal(ipSignal)
    tel.ipSignal = ipSignal
    const ip = ipSignal.ip

    const body = await request.json()
    const { company1Id, company2Id, company3Id, turnstile_token, botd, voterId } = body

    // Identità ordinaria: cookie first-party > voterId nel payload. Niente
    // fallback al FingerprintJS (collisioni) né chiave nuova per richiesta.
    const resolved = resolveVoterKey(request, voterId)
    if (!resolved) {
      tel.outcome = 'invalid_request'
      tel.status = 400
      return NextResponse.json({ error: err('voteError.missingVoterId') }, { status: 400 })
    }

    const respond = (
      payload: unknown,
      status: number,
      outcome: VoteOutcome,
      headers?: Record<string, string>,
    ) => {
      tel.outcome = outcome
      tel.status = status
      const response = NextResponse.json(payload, { status })
      if (headers) {
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
      }
      applyVoterCookie(response, resolved.voterId)
      return response
    }

    const admin = createAdminClient()

    // P0-4 (gated da SESSION_IDENTITY_MODE, default `off` → nessun effetto).
    // Dual-read: se esiste una sessione valida, il suo principal è l'autorità;
    // si usa il fingerprint legacy del principal per mantenere il dedup.
    const identityMode = sessionIdentityMode()
    let fingerprint = resolveVoteFingerprint(resolved.key)
    let principalId: string | null = null
    let eventId: string | null = null
    if (identityMode !== 'off') {
      const keyring = keyringFromEnv()
      const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value
      if (keyring) {
        principalId = await resolveSessionPrincipal(admin, sessionCookie, keyring)
      }
      const event = await getActiveEvent(admin)
      eventId = event?.id ?? null
      if (!principalId && event) {
        principalId = await resolveOrCreatePrincipal(admin, event.id, fingerprint)
      }
      if (principalId) {
        const { data: principal } = await admin
          .from('event_principals')
          .select('legacy_fingerprint')
          .eq('id', principalId)
          .maybeSingle()
        if (principal?.legacy_fingerprint) fingerprint = principal.legacy_fingerprint
      }
      // Cutover: senza sessione valida non si vota.
      if (identityMode === 'session' && !principalId) {
        return respond({ error: err('voteError.missingVoterId') }, 400, 'invalid_request')
      }
    }

    // P0-3: rate limit su segnali attendibili (identità + IP pseudonimizzato).
    const rate = await evaluateVoteRateLimit({
      ipHash: ip ? hmacIp(ip) : null,
      fingerprint,
    })
    tel.rateMode = rate.mode
    tel.rateWouldBlock = !rate.rawAllowed
    const rateIpAllowed = rate.scopes.find((s) => s.scope === 'ip')?.allowed ?? null
    const rateIdAllowed = rate.scopes.find((s) => s.scope === 'id')?.allowed ?? null
    tel.rateScopes = { ip: rateIpAllowed, id: rateIdAllowed }
    tel.rateIpWouldBlock = rateIpAllowed === false
    tel.rateIdWouldBlock = rateIdAllowed === false
    if (!rate.allowed) {
      return respond({ error: err('voteError.rateLimited') }, 429, 'rate_limited', {
        'Retry-After': String(rate.retryAfterSec),
      })
    }

    // Gate anti-bot: il toggle Admin sospende il voto anche server-side.
    if (await getAntibotEnabled()) {
      return respond({ error: err('voteError.antibot') }, 423, 'antibot')
    }

    if ((await getFairEndState()).enabled) {
      return respond({ error: err('voteError.fairEnded') }, 423, 'fair_ended')
    }

    if (!company1Id || !company2Id || !company3Id) {
      return respond({ error: err('voteError.missingFields') }, 400, 'invalid_request')
    }

    if (company1Id === company2Id || company1Id === company3Id || company2Id === company3Id) {
      return respond({ error: err('voteError.duplicateCompanies') }, 400, 'invalid_request')
    }

    // Batch attivo e lookup aziende in parallelo.
    const [activeBatch, { data: companies }] = await Promise.all([
      getActiveBatch(),
      admin
        .from('companies')
        .select('id, batch, blocked')
        .in('id', [company1Id, company2Id, company3Id]),
    ])

    if (!companies || companies.length !== 3) {
      return respond({ error: err('voteError.companiesNotFound') }, 400, 'invalid_request')
    }

    for (const company of companies) {
      if (company.batch !== activeBatch) {
        return respond({ error: err('voteError.companyNotInBatch') }, 400, 'invalid_request')
      }
    }

    // Aziende escluse dall'Admin: blocco server-side (oltre alla UI).
    if (companies.some((company) => company.blocked === true)) {
      return respond({ error: err('voteError.companyBlocked') }, 400, 'invalid_request')
    }

    if (!turnstile_token) {
      return respond({ error: err('voteError.missingSecurity') }, 400, 'missing_security')
    }

    const verification = await verifyTurnstile(turnstile_token)
    if (!verification.ok) {
      tel.turnstileReason = verification.reason
      console.warn('[turnstile] verifica fallita:', verification.reason)
      return respond({ error: err('voteError.securityFailed') }, 400, 'turnstile_failed')
    }

    const userAgent = request.headers.get('user-agent') || ''
    const country = request.headers.get('cf-ipcountry') || 'IT'

    const { success, error: submitError } = await submitVote({
      fingerprint,
      ip: ip ?? 'unknown',
      userAgent,
      country,
      company1Id,
      company2Id,
      company3Id,
      botd: botd || '',
    })

    if (!success) {
      if (submitError?.includes('Hai già votato oggi')) {
        return respond({ error: err('voteError.alreadyVoted') }, 409, 'already_voted')
      }
      if (submitError) {
        return respond({ error: submitError }, 400, 'error')
      }
      return respond({ error: 'Vote rejected' }, 400, 'error')
    }

    // Dual-write shadow: collega la scheda al principal. Best-effort.
    if (identityMode !== 'off' && principalId && eventId) {
      try {
        await linkVoteToPrincipal(admin, fingerprint, romeDateKey(new Date()), eventId, principalId)
      } catch (linkError) {
        console.warn('[identity] linkVoteToPrincipal failed:', linkError)
      }
    }

    return respond({ success: true }, 200, 'success')
  } catch (error) {
    console.error('Vote error:', error)
    tel.outcome = 'error'
    tel.status = 500
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    logVoteRequestEnd({
      outcome: tel.outcome ?? 'error',
      status: tel.status ?? 500,
      ms: Date.now() - startedAt,
      rateMode: tel.rateMode,
      rateWouldBlock: tel.rateWouldBlock,
      rateIpWouldBlock: tel.rateIpWouldBlock,
      rateIdWouldBlock: tel.rateIdWouldBlock,
      rateScopes: tel.rateScopes,
      ipSource: tel.ipSignal?.source,
      ipConfidence: tel.ipSignal?.confidence,
      ipHasDetected: tel.ipSignal ? tel.ipSignal.detectedIp !== null : undefined,
      turnstileReason: tel.turnstileReason,
    })
  }
}
