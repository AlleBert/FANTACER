import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveFingerprint } from '@/lib/vote-dev-bypass'

interface VoteSessionRow {
  company1_id: string
  company2_id: string
  company3_id: string
  pallet1: number
  pallet2: number
  pallet3: number
}

/** Confine giornata UTC, coerente con `created_at::date = current_date` della dedup voto. */
export function utcDayBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const visitorId = body?.visitorId
    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 128) {
      return NextResponse.json(
        { error: 'visitorId is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const supabase = createAdminClient()
    // Nota dev-only: con DEV_BYPASS_VOTE_LIMIT=1 `resolveFingerprint` restituisce un id
    // casuale a ogni chiamata, quindi lo status restituisce sempre voted:false e cancella
    // l'id memorizzato. Comportamento atteso in dev, non un bug.
    const fingerprint = resolveFingerprint(visitorId)
    const { start, end } = utcDayBounds()

    const { data: session, error } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3')
      .eq('fingerprint', fingerprint)
      .gte('created_at', start)
      .lt('created_at', end)
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
