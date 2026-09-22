import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cache CDN molto breve: il flag cambia solo da Admin (raro) e i client con
// realtime attivo ricevono comunque l'evento `site_settings`. La finestra corta
// serve agli altri client, che si riallineano quasi subito.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=5, stale-while-revalidate=30';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'antibot_enabled')
      .single();

    if (error) {
      // Se il record non esiste, default a false (nessun blocco anti-bot)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: false }, { headers: { 'Cache-Control': CACHE_CONTROL } });
      }
      throw error;
    }
    return NextResponse.json(
      { enabled: data.value === 'true' },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (e) {
    console.error('Failed to read antibot_enabled:', e);
    return NextResponse.json({ enabled: false });
  }
}
