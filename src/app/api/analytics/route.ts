import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    if (type === 'summary') {
      // Get summary stats
      const { data: stats } = await supabase
        .from('daily_stats')
        .select('*')
        .order('date', { ascending: false })
        .limit(30)

      const { count: totalVotes } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })

      const { data: voterData } = await supabase
        .from('votes')
        .select('fingerprint')
      
      const uniqueVoters = new Set((voterData || []).map(v => v.fingerprint)).size

      return NextResponse.json({
        totalVotes: totalVotes || 0,
        uniqueVoters: uniqueVoters || 0,
        dailyStats: stats || []
      })
    }

    if (type === 'detailed') {
      const query = supabase
        .from('analytics_raw')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dateFrom) query.gte('created_at', dateFrom)
      if (dateTo) query.lte('created_at', dateTo)

      const { data, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || [] })
    }

    if (type === 'export') {
      // Export for monetization - CSV format
      const { data } = await supabase
        .from('votes')
        .select('company_id, fingerprint, created_at, country, user_agent')
        .order('created_at', { ascending: false })

      // Get company names
      const { data: companies } = await supabase.from('companies').select('id, name')
      const companyMap = new Map((companies || []).map(c => [c.id, c.name]))

      const csv = [
        ['company_id', 'company_name', 'fingerprint', 'timestamp', 'country', 'user_agent'].join(','),
        ...(data || []).map(v => [
          v.company_id,
          companyMap.get(v.company_id) || '',
          v.fingerprint,
          v.created_at,
          v.country || '',
          (v.user_agent || '').replace(/,/g, ';')
        ].join(','))
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=fantacer_export.csv'
        }
      })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}