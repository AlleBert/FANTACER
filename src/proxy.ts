import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const envOverride = process.env.NEXT_PUBLIC_9X4M2K8L === 'm9fK2pL7xQ';

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

  if (!envOverride && !dbEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
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
