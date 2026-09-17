import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Gli sponsor cambiano solo da Admin: cache CDN lunga, con revalidation in
// background. Elimina la query DB per ogni card (montata 3 volte in homepage).
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sponsors')
    .select('id, name, image_url, website_url, has_stand')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ sponsors: data || [] }, { headers: { 'Cache-Control': CACHE_CONTROL } })
}
