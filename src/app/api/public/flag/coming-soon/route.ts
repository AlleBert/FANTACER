import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single();

    if (error) throw error;
    return NextResponse.json({ enabled: data.value === 'true' });
  } catch (e) {
    console.error('Failed to read coming_soon_enabled:', e);
    return NextResponse.json({ enabled: false });
  }
}
