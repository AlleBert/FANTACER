import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Get companies for name resolution
    const { data: companies } = await supabase.from('companies').select('id, name')
    const companyMap = new Map((companies || []).map(c => [c.id, c.name]))

    let query = supabase
      .from('vote_sessions')
      .select('id, fingerprint, ip_hash, user_agent, country, company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, created_at', { count: 'exact' })

    // Search filtering is done in-memory after fetch for simplicity

    const { data: sessions, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

    let result = (sessions || []).map(v => ({
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

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(v =>
        v.pallets.some(p => p.company.toLowerCase().includes(searchLower))
      )
    }

    const total = search ? result.length : (count || 0)

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
