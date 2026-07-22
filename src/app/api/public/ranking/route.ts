import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('get_company_ranking', { limit_count: null })

  if (error) {
    console.error('Ranking error:', error)
    return NextResponse.json({ companies: [] })
  }

  return NextResponse.json({ companies: data || [] })
}
