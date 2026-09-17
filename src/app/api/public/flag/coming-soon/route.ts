import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CACHE_CONTROL = 'public, max-age=0, s-maxage=15, stale-while-revalidate=60';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single();

    if (error) throw error;
    return NextResponse.json(
      { enabled: data.value === 'true' },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (e) {
    console.error('Failed to read coming_soon_enabled:', e);
    return NextResponse.json({ enabled: false });
  }
}
