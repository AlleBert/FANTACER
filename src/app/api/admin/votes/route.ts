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

    // Get companies for join
    const { data: companies } = await supabase.from('companies').select('id, name')
    const companyMap = new Map((companies || []).map(c => [c.id, c.name]))

    let query = supabase
      .from('votes')
      .select('id, company_id, fingerprint, country, user_agent, created_at')
      .order('created_at', { ascending: false })

    if (search) {
      // Filter by company name (requires join, so we fetch more and filter)
      const matchingCompanyIds = (companies || [])
        .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        .map(c => c.id)
      
      if (matchingCompanyIds.length > 0) {
        query = query.in('company_id', matchingCompanyIds)
      }
    }

    const { data: votes, error } = await query.range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Helper to parse user-agent into readable device info
    const parseDevice = (ua: string | null): string => {
      if (!ua) return '-'
      ua = ua.toLowerCase()
      
      // Detect device type and browser
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
        const device = ua.includes('iphone') ? 'iPhone' : ua.includes('ipad') ? 'iPad' : 'iPod'
        const version = ua.match(/os (\d+)_(\d+)/)
        const ver = version ? `${version[1]}.${version[2]}` : ''
        const safari = ua.includes('version/') ? ua.match(/version\/(\d+\.\d+)/)?.[1] : ''
        return safari ? `iOS ${ver} (Safari ${safari})` : `iOS ${ver}`
      }
      
      if (ua.includes('android')) {
        const version = ua.match(/android (\d+\.\d+)/)
        const ver = version ? version[1] : ''
        const mobile = ua.includes('mobile') ? ' Mobile' : ''
        return `Android${ver}${mobile}`
      }
      
      if (ua.includes('macintosh')) {
        const safari = ua.includes('safari') ? ' (Safari)' : ''
        return `macOS${safari}`
      }
      
      if (ua.includes('windows')) {
        return 'Windows'
      }
      
      if (ua.includes('linux')) {
        return 'Linux'
      }
      
      // Fallback: first 2 parts
      const parts = ua.split(' ').slice(0, 2).join(' ')
      return parts.length > 30 ? parts.substring(0, 30) + '...' : parts
    }

    const result = (votes || []).map(v => ({
      id: v.id,
      timestamp: v.created_at,
      company: companyMap.get(v.company_id) || 'Unknown',
      fingerprint: v.fingerprint ? v.fingerprint.slice(0, 8) + '...' : '-',
      country: v.country || '-',
      device: parseDevice(v.user_agent)
    }))

    // Get total count
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}