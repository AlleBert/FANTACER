import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isVoteLimitBypassed, resolveFingerprint } from '@/lib/vote-dev-bypass'

const MAX_VISITOR_ID_LENGTH = 128

interface VoteSessionRow {
  company1_id: string
  company2_id: string
  company3_id: string
  pallet1: number
  pallet2: number
  pallet3: number
}

const romeDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Giorno corrente (YYYY-MM-DD) nel fuso Europe/Rome, coerente con `vote_day`. */
export function romeDayKey(now = new Date()): string {
  return romeDayFormatter.format(now)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const visitorId = body?.visitorId
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > MAX_VISITOR_ID_LENGTH) {
      return NextResponse.json(
        { error: 'visitorId is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (isVoteLimitBypassed()) {
      // DEV ONLY (DEV_BYPASS_VOTE_LIMIT=1): resolveFingerprint randomizes the id,
      // so no session can be matched and restore is intentionally disabled.
      // Set DEV_BYPASS_VOTE_LIMIT=0 to exercise the restore flow locally.
      return NextResponse.json(
        { voted: false, bypassed: true },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const supabase = createAdminClient()
    const fingerprint = resolveFingerprint(visitorId)

    const { data: session, error } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3')
      .eq('fingerprint', fingerprint)
      .eq('vote_day', romeDayKey())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (!session) {
      return NextResponse.json({ voted: false }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const row = session as VoteSessionRow
    const ids = [row.company1_id, row.company2_id, row.company3_id]
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', ids)

    if (companiesError) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const nameById = new Map(
      (companies || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    )

    const votedCompanies = [
      { id: row.company1_id, name: nameById.get(row.company1_id) ?? '', pallet: row.pallet1 },
      { id: row.company2_id, name: nameById.get(row.company2_id) ?? '', pallet: row.pallet2 },
      { id: row.company3_id, name: nameById.get(row.company3_id) ?? '', pallet: row.pallet3 },
    ]

    return NextResponse.json(
      { voted: true, companies: votedCompanies },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Vote status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
