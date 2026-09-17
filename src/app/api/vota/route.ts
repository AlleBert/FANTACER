import { NextRequest, NextResponse } from 'next/server'
import { submitVote } from '@/lib/supabase/vote-api'
import { getActiveBatch } from '@/lib/supabase/batch'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFingerprint } from '@/lib/vote-dev-bypass'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { translate } from '@/i18n'

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return true

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`
  })

  const outcome = await response.json()
  return outcome.success
}

export async function POST(request: NextRequest) {
  try {
    const locale = resolveLocale(
      request.headers.get('accept-language'),
      request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    )
    const err = (key: Parameters<typeof translate>[1]) => translate(locale, key)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const body = await request.json()
    const { company1Id, company2Id, company3Id, turnstile_token, botd, visitorId } = body

    if (!company1Id || !company2Id || !company3Id || !visitorId) {
      return NextResponse.json({ error: err('voteError.missingFields') }, { status: 400 })
    }

    if (company1Id === company2Id || company1Id === company3Id || company2Id === company3Id) {
      return NextResponse.json({ error: err('voteError.duplicateCompanies') }, { status: 400 })
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
      return NextResponse.json({ error: err('voteError.companiesNotFound') }, { status: 400 })
    }

    for (const company of companies) {
      if (company.batch !== activeBatch) {
        return NextResponse.json({ error: err('voteError.companyNotInBatch') }, { status: 400 })
      }
    }

    if (!turnstile_token) {
      return NextResponse.json({ error: err('voteError.missingSecurity') }, { status: 400 })
    }

    const isHuman = await verifyTurnstile(turnstile_token, ip)
    if (!isHuman) {
      return NextResponse.json({ error: err('voteError.securityFailed') }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent') || ''
    const country = request.headers.get('cf-ipcountry') || 'IT'

    const { success, error: submitError } = await submitVote({
      fingerprint: resolveFingerprint(visitorId),
      ip,
      userAgent,
      country,
      company1Id,
      company2Id,
      company3Id,
      botd: botd || '',
    })

    if (!success) {
      if (submitError?.includes('Hai già votato oggi')) {
        return NextResponse.json({ error: err('voteError.alreadyVoted') }, { status: 409 })
      }
      if (submitError) {
        return NextResponse.json({ error: submitError }, { status: 400 })
      }
      return NextResponse.json({ error: 'Vote rejected' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}