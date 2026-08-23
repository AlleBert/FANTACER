import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('get_company_ranking', { limit_count: null })

  if (error) {
    console.error('Ranking error:', error)
    return NextResponse.json({ companies: [] })
  }

  // La RPC ordina già deterministicamente (pallets desc, name asc, id asc):
  // il rank è la posizione 1-based nell'array ordinato.
  const companies = (data || []).map((c: Record<string, unknown>, index: number) => ({
    ...c,
    rank: index + 1,
  }))

  return NextResponse.json({ companies })
}
