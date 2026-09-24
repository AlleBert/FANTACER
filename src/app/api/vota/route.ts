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
import {
  logVoteRequestEnd,
  type VoteOutcome,
  type VoteIdentityMode,
} from '@/lib/vote-telemetry'
import { keyringFromEnv } from '@/lib/session-identity'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'
import { buildVoteRiskSignals, signalsFingerprint } from '@/lib/vote-risk-signals'
import {
  sessionIdentityMode,
  getActiveEvent,
  resolveOrCreatePrincipal,
  resolveVoteIdentity,
  linkVoteToPrincipal,
  touchSession,
  type ResolvedSession,
} from '@/lib/session-identity-server'
import { romeDateKey } from '@/lib/admin-analytics'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

interface VoteTelemetry {
  outcome?: VoteOutcome
  status?: number
  identityMode?: VoteIdentityMode
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
    // C08 — `voterId` è rimosso dal contratto: non viene **mai** letto dal body.
    // L'identità arriva solo dalla sessione o dal cookie legacy first-party.
    const { company1Id, company2Id, company3Id, turnstile_token, botd } = body

    const identityMode = sessionIdentityMode()
    tel.identityMode = identityMode

    let voterCookieId: string | null = null
    let fingerprint: string | null = null
    let principalId: string | null = null
    let eventId: string | null = null
    let session: ResolvedSession | null = null

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
      if (voterCookieId) applyVoterCookie(response, voterCookieId)
      return response
    }

    const admin = createAdminClient()

    /**
     * Sceglie il fingerprint legacy del principal di sessione (per mantenere il
     * dedup legacy) e, in assenza, un fallback stabile `principal:<id>`.
     * Best-effort: non blocca mai per un errore di lookup.
     */
    const applyPrincipalFingerprint = async (): Promise<void> => {
      if (!principalId) return
      try {
        const { data: principal } = await admin
          .from('event_principals')
          .select('legacy_fingerprint')
          .eq('id', principalId)
          .maybeSingle()
        if (principal?.legacy_fingerprint) {
          fingerprint = principal.legacy_fingerprint
          return
        }
      } catch {
        // best-effort: cade sul fallback qui sotto
      }
      if (!fingerprint) fingerprint = `principal:${principalId}`
    }

    if (identityMode === 'off') {
      // Legacy-only: identità dal solo cookie first-party. Nessun principal,
      // nessuna chiamata a `submit_vote_v2`, nessun dual-write.
      const legacy = resolveVoterKey(request)
      if (!legacy) {
        return respond({ error: err('voteError.missingVoterId') }, 400, 'invalid_request')
      }
      voterCookieId = legacy.voterId
      fingerprint = resolveVoteFingerprint(legacy.key)
    } else if (identityMode === 'shadow') {
      // Lettura legacy; scrittura legacy + principal best-effort. Qualunque
      // errore del percorso shadow viene loggato e **non** blocca il voto.
      const legacy = resolveVoterKey(request)
      if (!legacy) {
        return respond({ error: err('voteError.missingVoterId') }, 400, 'invalid_request')
      }
      voterCookieId = legacy.voterId
      fingerprint = resolveVoteFingerprint(legacy.key)
      try {
        const keyring = keyringFromEnv()
        if (keyring) {
          session = await resolveVoteIdentity(admin, request, keyring)
          if (session) principalId = session.principalId
        }
        const event = await getActiveEvent(admin)
        eventId = event?.id ?? null
        if (!principalId && eventId && fingerprint) {
          principalId = await resolveOrCreatePrincipal(admin, eventId, fingerprint)
        }
        await applyPrincipalFingerprint()
      } catch (shadowError) {
        console.warn('[identity] shadow path best-effort failed:', shadowError)
        principalId = null
        eventId = null
        session = null
      }
    } else {
      // dual | session: la sessione è l'autorità (fail-closed).
      const keyring = keyringFromEnv()
      if (!keyring) {
        // Modalità sessione dichiarata ma chiave assente: nessun voto.
        return respond({ error: 'identity unavailable' }, 503, 'no_session')
      }
      try {
        session = await resolveVoteIdentity(admin, request, keyring)
      } catch (sessionError) {
        // Errore infrastrutturale (non assenza): fail-closed 503, nessun voto.
        console.warn('[identity] session resolution failed:', sessionError)
        return respond({ error: 'identity unavailable' }, 503, 'error')
      }

      if (session) {
        principalId = session.principalId
        // C05 — CSRF session-bound (§4-bis): solo `dual`/`session` con sessione
        // valida. Il rinnovo idle avviene solo dopo il CSRF ok.
        const csrf = verifyCsrfForRequest(request, keyring, session)
        if (!csrf.ok) {
          return respond({ error: 'Forbidden' }, 403, 'csrf_failed')
        }
        await touchSession(admin, session.sessionId)
        const event = await getActiveEvent(admin)
        eventId = event?.id ?? null
        await applyPrincipalFingerprint()
      } else if (identityMode === 'session') {
        // Cutover: solo sessione, nessun fallback legacy.
        return respond({ error: 'identity unavailable' }, 503, 'no_session')
      } else {
        // dual: fallback al cookie legacy first-party (mai body).
        const legacy = resolveVoterKey(request)
        if (!legacy) {
          return respond({ error: err('voteError.missingVoterId') }, 400, 'invalid_request')
        }
        voterCookieId = legacy.voterId
        fingerprint = resolveVoteFingerprint(legacy.key)
        const event = await getActiveEvent(admin)
        eventId = event?.id ?? null
        if (eventId) {
          principalId = await resolveOrCreatePrincipal(admin, eventId, fingerprint)
          if (!principalId) {
            return respond({ error: 'identity unavailable' }, 503, 'error')
          }
          await applyPrincipalFingerprint()
        }
      }
    }

    if (!fingerprint) {
      return respond({ error: 'identity unavailable' }, 503, 'no_session')
    }

    // C08 — Segnali di rischio server-derived, groundwork per correlazione,
    // step-up e quarantena (la decisione pura è in `vote-correlation.ts`; la
    // persistenza/quarantine è C11). Best-effort: l'errore di configurazione
    // HMAC non deve bloccare il voto (in `shadow` è esplicitamente
    // non-bloccante) e in C08 i segnali non decidono nulla.
    try {
      const signals = buildVoteRiskSignals({
        ipSignal,
        userAgent: request.headers.get('user-agent'),
        country: request.headers.get('cf-ipcountry'),
        botd: typeof botd === 'string' ? botd : null,
        legacyFpPresent: voterCookieId !== null,
      })
      // Fingerprint deterministico per la futura decisione di correlazione.
      signalsFingerprint(signals)
    } catch (signalsError) {
      console.warn('[identity] risk signals unavailable:', signalsError)
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

    // Dual-write shadow/dual: collega la scheda al principal. Best-effort in
    // ogni mode (in `off` non esiste alcun principal).
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
      identityMode: tel.identityMode,
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
