import { NextResponse } from 'next/server'
import { getActiveBatch } from '@/lib/supabase/batch'

// Il batch attivo cambia raramente (solo da Admin): cache CDN breve ma
// sufficiente a evitare la query per ogni pageview.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600'

export async function GET() {
  try {
    const activeBatch = await getActiveBatch()
    return NextResponse.json({ activeBatch }, { headers: { 'Cache-Control': CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ activeBatch: 'TEST' })
  }
}
