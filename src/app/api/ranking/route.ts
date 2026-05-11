import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBatch } from '@/lib/supabase/batch'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const includeTrend = searchParams.get('trend') === 'true'
    const activeBatch = await getActiveBatch()

    // Get vote counts by company
    const { data: votes, error } = await supabase
      .from('votes')
      .select('company_id, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count votes per company
    const voteCounts = new Map<string, { current: number; previous: number }>()
    
    for (const vote of votes || []) {
      const companyId = vote.company_id
      const isRecent = new Date(vote.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const current = voteCounts.get(companyId) || { current: 0, previous: 0 }
      current.current += isRecent ? 1 : 0
      current.previous += isRecent ? 0 : 1
      voteCounts.set(companyId, current)
    }

    // Get top companies (only from active batch)
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, category, image_url')
      .eq('batch', activeBatch)

    // Merge with vote counts
    const ranking = (companies || [])
      .map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        image_url: c.image_url,
        votes: voteCounts.get(c.id)?.current || 0,
        trend: includeTrend 
          ? ((voteCounts.get(c.id)?.current || 0) - (voteCounts.get(c.id)?.previous || 0))
          : undefined
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, limit)

    return NextResponse.json({ ranking })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}