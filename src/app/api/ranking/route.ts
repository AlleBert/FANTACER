import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBatch } from '@/lib/supabase/batch'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const activeBatch = await getActiveBatch()

    const { data: sessions } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3, created_at')

    const palletCounts = new Map<string, number>()

    for (const s of sessions || []) {
      const entries = [
        { id: s.company1_id, pallet: s.pallet1 },
        { id: s.company2_id, pallet: s.pallet2 },
        { id: s.company3_id, pallet: s.pallet3 },
      ]
      for (const e of entries) {
        palletCounts.set(e.id, (palletCounts.get(e.id) || 0) + e.pallet)
      }
    }

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, category, image_url')
      .eq('batch', activeBatch)

    const ranking = (companies || [])
      .map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        image_url: c.image_url,
        votes: palletCounts.get(c.id) || 0,
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, limit)

    return NextResponse.json({ ranking })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
