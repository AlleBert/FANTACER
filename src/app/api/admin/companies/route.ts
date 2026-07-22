import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const batch = searchParams.get('batch')

    // Get companies with vote counts
    let query = supabase
      .from('companies')
      .select('id, name, category, image_url, batch')
      .ilike('name', `%${search}%`)
      .order('name')

    if (batch) {
      query = query.eq('batch', batch)
    }

    const { data: companies, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get pallet counts per company from vote_sessions
    const { data: sessions } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, created_at')

    const palletCounts: Record<string, number> = {}
    const todayVotes: Record<string, number> = {}
    const yesterdayVotes: Record<string, number> = {}
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    for (const s of sessions || []) {
      const date = s.created_at.split('T')[0]
      const entries = [
        { id: s.company1_id, pallet: s.pallet1 },
        { id: s.company2_id, pallet: s.pallet2 },
        { id: s.company3_id, pallet: s.pallet3 },
      ]
      for (const e of entries) {
        palletCounts[e.id] = (palletCounts[e.id] || 0) + e.pallet
        if (date === today) todayVotes[e.id] = (todayVotes[e.id] || 0) + 1
        if (date === yesterday) yesterdayVotes[e.id] = (yesterdayVotes[e.id] || 0) + 1
      }
    }

    const result = (companies || []).map((c, idx) => {
      const totalPallets = palletCounts[c.id] || 0
      const todayV = todayVotes[c.id] || 0
      const yesterdayV = yesterdayVotes[c.id] || 0
      const trend = todayV - yesterdayV
      
      return {
        rank: idx + 1,
        id: c.id,
        name: c.name,
        category: c.category || '-',
        image_url: c.image_url,
        votes: totalPallets,
        trend
      }
    })

    // Sort by pallets desc by default
    result.sort((a, b) => b.votes - a.votes)

    // Re-assign ranks after sorting
    result.forEach((r, i) => r.rank = i + 1)

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}