import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'
import { fetchAllRows } from '@/lib/fetch-all'

interface VoteSessionRow {
  id: string
  fingerprint: string | null
  user_agent: string | null
  country: string | null
  company1_id: string
  company2_id: string
  company3_id: string
  pallet1: number
  pallet2: number
  pallet3: number
  created_at: string
}

const touchesAny = (
  session: Pick<VoteSessionRow, 'company1_id' | 'company2_id' | 'company3_id'>,
  ids: Set<string>,
): boolean =>
  ids.has(session.company1_id) ||
  ids.has(session.company2_id) ||
  ids.has(session.company3_id)

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')))
    const search = (searchParams.get('search') || '').trim()
    const batch = searchParams.get('batch')
    const offset = (page - 1) * limit

    const { data: companies } = await supabase.from('companies').select('id, name, batch')
    const companyMap = new Map(
      (companies || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    )

    // Filtro batch e ricerca risolti PRIMA della paginazione, così `total` e
    // `pages` sono corretti (prima il range veniva applicato e la ricerca
    // filtrava solo i 25 record della pagina corrente).
    const searchLower = search.toLowerCase()
    const searchIds = search
      ? new Set(
          (companies || [])
            .filter((c: { name: string }) => c.name.toLowerCase().includes(searchLower))
            .map((c: { id: string }) => c.id),
        )
      : null
    const batchIds =
      batch && batch !== 'all'
        ? new Set(
            (companies || [])
              .filter((c: { batch: string | null }) => c.batch === batch)
              .map((c: { id: string }) => c.id),
          )
        : null

    const { data: sessions, error } = await fetchAllRows<VoteSessionRow>((from, to) =>
      supabase
        .from('vote_sessions')
        .select(
          'id, fingerprint, user_agent, country, company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, created_at',
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    )

    if (error) return NextResponse.json({ error }, { status: 500 })

    let filtered = sessions
    if (batchIds) filtered = filtered.filter((s) => touchesAny(s, batchIds))
    if (searchIds) filtered = filtered.filter((s) => touchesAny(s, searchIds))

    const total = filtered.length
    const pageSessions = filtered.slice(offset, offset + limit)

    const parseDevice = (ua: string | null): string => {
      if (!ua) return '-'
      ua = ua.toLowerCase()
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS'
      if (ua.includes('android')) return 'Android'
      if (ua.includes('macintosh')) return 'macOS'
      if (ua.includes('windows')) return 'Windows'
      if (ua.includes('linux')) return 'Linux'
      return ua.substring(0, 20)
    }

    const result = pageSessions.map((v) => ({
      id: v.id,
      timestamp: v.created_at,
      fingerprint: v.fingerprint ? v.fingerprint.slice(0, 8) + '...' : '-',
      country: v.country || '-',
      device: parseDevice(v.user_agent),
      pallets: [
        { company: companyMap.get(v.company1_id) || v.company1_id.substring(0, 8), pallet: v.pallet1 },
        { company: companyMap.get(v.company2_id) || v.company2_id.substring(0, 8), pallet: v.pallet2 },
        { company: companyMap.get(v.company3_id) || v.company3_id.substring(0, 8), pallet: v.pallet3 },
      ],
    }))

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : status === 403 ? 'Accesso negato' : 'Internal server error' },
      { status },
    )
  }
}
