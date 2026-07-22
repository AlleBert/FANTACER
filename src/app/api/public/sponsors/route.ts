import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sponsors')
    .select('id, name, image_url, website_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ sponsors: data || [] })
}
