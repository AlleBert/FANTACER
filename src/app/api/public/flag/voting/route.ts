import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cache CDN breve: il flag cambia solo da Admin e i client con realtime attivo
// ricevono comunque l'evento `site_settings`. Gli altri si riallineano entro
// la finestra di stale-while-revalidate.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=15, stale-while-revalidate=60';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'voting_enabled')
      .single();

    if (error) {
      // Se il record non esiste, default a true (votazioni attive)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: true }, { headers: { 'Cache-Control': CACHE_CONTROL } });
      }
      throw error;
    }
    return NextResponse.json(
      { enabled: data.value === 'true' },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (e) {
    console.error('Failed to read voting_enabled:', e);
    return NextResponse.json({ enabled: true });
  }
}
