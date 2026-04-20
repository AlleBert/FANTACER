import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // Get companies with vote counts
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, category, image_url, batch')
      .ilike('name', `%${search}%`)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get vote counts per company
    const { data: votes } = await supabase
      .from('votes')
      .select('company_id, created_at')

    const voteCounts: Record<string, number> = {}
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const yesterdayVotes: Record<string, number> = {}
    const todayVotes: Record<string, number> = {}

    votes?.forEach(v => {
      const date = v.created_at.split('T')[0]
      voteCounts[v.company_id] = (voteCounts[v.company_id] || 0) + 1
      
      if (date === today) todayVotes[v.company_id] = (todayVotes[v.company_id] || 0) + 1
      if (date === yesterday) yesterdayVotes[v.company_id] = (yesterdayVotes[v.company_id] || 0) + 1
    })

    const result = (companies || []).map((c, idx) => {
      const votes = voteCounts[c.id] || 0
      const todayV = todayVotes[c.id] || 0
      const yesterdayV = yesterdayVotes[c.id] || 0
      const trend = todayV - yesterdayV
      
      return {
        rank: idx + 1,
        id: c.id,
        name: c.name,
        category: c.category || '-',
        image_url: c.image_url,
        votes,
        trend
      }
    })

    // Sort by votes desc by default
    result.sort((a, b) => b.votes - a.votes)

    // Re-assign ranks after sorting
    result.forEach((r, i) => r.rank = i + 1)

    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}