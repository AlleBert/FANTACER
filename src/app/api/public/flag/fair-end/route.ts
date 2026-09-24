import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_FAIR_END_CONFIG, parseFairEndConfig } from '@/lib/fair-end';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CACHE_CONTROL = 'public, max-age=0, s-maxage=5, stale-while-revalidate=30';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['fair_end_enabled', 'fair_end_config']);
    if (error) throw error;
    let enabled = false;
    let config = { ...DEFAULT_FAIR_END_CONFIG };
    for (const row of data ?? []) {
      if (row.key === 'fair_end_enabled') enabled = row.value === 'true';
      if (row.key === 'fair_end_config') config = parseFairEndConfig(row.value);
    }
    return NextResponse.json(
      { enabled, revealAt: config.revealAt, ceremony: config.ceremony },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (e) {
    console.error('Failed to read fair_end:', e);
    return NextResponse.json({ enabled: false, revealAt: null, ceremony: DEFAULT_FAIR_END_CONFIG.ceremony });
  }
}
