import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let dbEnabled = false;
  try {
    const flagUrl = new URL('/api/public/flag/coming-soon', request.url);
    const res = await fetch(flagUrl);
    if (res.ok) {
      const data = await res.json();
      dbEnabled = data.enabled === true;
    }
  } catch {
    // failsafe: if fetch fails, site stays live
  }

  if (!dbEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin/')) {
    return NextResponse.next();
  }

  if (pathname === '/coming-soon') {
    return NextResponse.next();
  }

  const url = new URL('/coming-soon', request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
