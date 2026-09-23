import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/supabase/vote-api'
import { getActiveBatch } from '@/lib/supabase/batch'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveVoteFingerprint } from '@/lib/vote-dev-bypass'
import { resolveVoterKey, applyVoterCookie } from '@/lib/vote-identity-server'
import { getAntibotEnabled } from '@/lib/site-flags'
import { verifyTurnstile } from '@/lib/turnstile'
import { getTrustedClientIp, hmacIp, type ClientIpSignal } from '@/lib/request-ip'
import { recordIpSignal } from '@/lib/ip-signal-metrics'
import { evaluateVoteRateLimit } from '@/lib/vote-rate-limit'
import { logVoteRequestEnd, type VoteOutcome } from '@/lib/vote-telemetry'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

interface VoteTelemetry {
  outcome?: VoteOutcome
  status?: number
  rateMode?: 'observe' | 'enforce'
  rateWouldBlock?: boolean
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

    // P0-3: rate limit su segnali attendibili (identità + IP pseudonimizzato).
    // Default `observe`: calcola e registra senza bloccare. `enforce` → 429.
    const fingerprint = resolveVoteFingerprint(resolved.key)
    const rate = await evaluateVoteRateLimit({
      ipHash: ip ? hmacIp(ip) : null,
      fingerprint,
    })
    tel.rateMode = rate.mode
    tel.rateWouldBlock = !rate.rawAllowed
    tel.rateScopes = {
      ip: rate.scopes.find((s) => s.scope === 'ip')?.allowed ?? null,
      id: rate.scopes.find((s) => s.scope === 'id')?.allowed ?? null,
    }
    if (!rate.allowed) {
      return respond({ error: err('voteError.rateLimited') }, 429, 'rate_limited', {
        'Retry-After': String(rate.retryAfterSec),
      })
    }

    // Gate anti-bot: il toggle Admin sospende il voto anche server-side, non
    // solo in UI. `423 Locked` distingue il blocco dagli errori di validazione.
    if (await getAntibotEnabled()) {
      return respond({ error: err('voteError.antibot') }, 423, 'antibot')
    }

    if (!company1Id || !company2Id || !company3Id) {
      return respond({ error: err('voteError.missingFields') }, 400, 'invalid_request')
    }

    if (company1Id === company2Id || company1Id === company3Id || company2Id === company3Id) {
      return respond({ error: err('voteError.duplicateCompanies') }, 400, 'invalid_request')
    }

    const supabaseAdmin = createAdminClient()

    // Batch attivo e lookup aziende sono indipendenti: in parallelo risparmiano
    // un round-trip DB seriale sul percorso critico del voto.
    const [activeBatch, { data: companies }] = await Promise.all([
      getActiveBatch(),
      supabaseAdmin
        .from('companies')
        .select('id, batch')
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

    if (!turnstile_token) {
      return respond({ error: err('voteError.missingSecurity') }, 400, 'missing_security')
    }

    const verification = await verifyTurnstile(turnstile_token)
    if (!verification.ok) {
      // Log del solo codice di motivo: mai token, secret, cookie o payload.
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
      rateScopes: tel.rateScopes,
      ipSource: tel.ipSignal?.source,
      ipConfidence: tel.ipSignal?.confidence,
      ipHasDetected: tel.ipSignal ? tel.ipSignal.detectedIp !== null : undefined,
      turnstileReason: tel.turnstileReason,
    })
  }
}
