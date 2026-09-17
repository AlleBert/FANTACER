import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Cache CDN breve: la classifica è identica per tutti i client e cambia al
// ritmo dei voti. `s-maxage` (3s) + `stale-while-revalidate` (30s) fanno
// servire la stragrande maggioranza delle richieste dal CDN di Vercel senza
// invocare la funzione né interrogare il DB. Il client ha comunque realtime
// (quando attivo) e polling di fallback per gli aggiornamenti.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=3, stale-while-revalidate=30'

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

  return NextResponse.json({ companies }, { headers: { 'Cache-Control': CACHE_CONTROL } })
}
