import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/supabase/vote-api'
import { getActiveBatch } from '@/lib/supabase/batch'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveVoteFingerprint } from '@/lib/vote-dev-bypass'
import { resolveVoterKey, applyVoterCookie } from '@/lib/vote-identity-server'
import { getAntibotEnabled } from '@/lib/site-flags'
import { verifyTurnstile } from '@/lib/turnstile'
import { getTrustedClientIp } from '@/lib/request-ip'
import { recordIpSignal } from '@/lib/ip-signal-metrics'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

export async function POST(request: NextRequest) {
  try {
    const locale = resolveLocale(
      request.headers.get('accept-language'),
      request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    )
    const err = (key: Parameters<typeof translate>[1]) => translate(locale, key)
    const ipSignal = getTrustedClientIp(request)
    recordIpSignal(ipSignal)
    const ip = ipSignal.ip

    const body = await request.json()
    const { company1Id, company2Id, company3Id, turnstile_token, botd, voterId } = body

    // Identità ordinaria: cookie first-party > voterId nel payload. Niente
    // fallback al FingerprintJS (collisioni) né chiave nuova per richiesta.
    const resolved = resolveVoterKey(request, voterId)
    if (!resolved) {
      return NextResponse.json({ error: err('voteError.missingVoterId') }, { status: 400 })
    }

    const respond = (payload: unknown, status = 200) => {
      const response = NextResponse.json(payload, { status })
      applyVoterCookie(response, resolved.voterId)
      return response
    }

    // Gate anti-bot: il toggle Admin sospende il voto anche server-side, non
    // solo in UI. `423 Locked` distingue il blocco dagli errori di validazione.
    if (await getAntibotEnabled()) {
      return respond({ error: err('voteError.antibot') }, 423)
    }

    if (!company1Id || !company2Id || !company3Id) {
      return respond({ error: err('voteError.missingFields') }, 400)
    }

    if (company1Id === company2Id || company1Id === company3Id || company2Id === company3Id) {
      return respond({ error: err('voteError.duplicateCompanies') }, 400)
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
      return respond({ error: err('voteError.companiesNotFound') }, 400)
    }

    for (const company of companies) {
      if (company.batch !== activeBatch) {
        return respond({ error: err('voteError.companyNotInBatch') }, 400)
      }
    }

    if (!turnstile_token) {
      return respond({ error: err('voteError.missingSecurity') }, 400)
    }

    const verification = await verifyTurnstile(turnstile_token)
    if (!verification.ok) {
      // Log del solo codice di motivo: mai token, secret, cookie o payload.
      console.warn('[turnstile] verifica fallita:', verification.reason)
      return respond({ error: err('voteError.securityFailed') }, 400)
    }

    const userAgent = request.headers.get('user-agent') || ''
    const country = request.headers.get('cf-ipcountry') || 'IT'

    const { success, error: submitError } = await submitVote({
      fingerprint: resolveVoteFingerprint(resolved.key),
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
        return respond({ error: err('voteError.alreadyVoted') }, 409)
      }
      if (submitError) {
        return respond({ error: submitError }, 400)
      }
      return respond({ error: 'Vote rejected' }, 400)
    }

    return respond({ success: true })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
