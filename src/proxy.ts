import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isComingSoonPage = pathname === '/coming-soon';

  let enabled = false;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single();
    enabled = data?.value === 'true';
  } catch {
    enabled = false;
  }

  if (isComingSoonPage) {
    if (enabled) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (enabled) return NextResponse.redirect(new URL('/coming-soon', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|admin).*)'],
};
