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
      .eq('key', 'voting_enabled')
      .single();

    if (error) {
      // Se il record non esiste, default a true (votazioni attive)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: true });
      }
      throw error;
    }
    return NextResponse.json({ enabled: data.value === 'true' });
  } catch (e) {
    console.error('Failed to read voting_enabled:', e);
    return NextResponse.json({ enabled: true });
  }
}
