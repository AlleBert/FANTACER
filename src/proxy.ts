import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const isComingSoon = process.env.NEXT_PUBLIC_9X4M2K8L === 'm9fK2pL7xQ';

  if (!isComingSoon) {
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
