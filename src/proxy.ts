import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';

const PROTECTED_PREFIXES = ['/admin/dashboard'];
const PROTECTED_API = ['/api/admin', '/api/analytics'];

// Paths reachable with AAL1 (or anonymously for /admin/login): session bootstrap
const PUBLIC_AUTH_PATHS = [
  '/admin/login',
  '/api/admin/login',
  '/api/admin/mfa',
  '/api/admin/logout',
];

function isProtected(pathname: string): boolean {
  if (PROTECTED_API.some((prefix) => pathname.startsWith(prefix))) {
    return !PUBLIC_AUTH_PATHS.some((prefix) => pathname.startsWith(prefix));
  }
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  if (isProtected(pathname)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (isApi) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Pages render only at AAL2; the MFA step happens inside /admin/login.
    // API handlers re-validate AAL inside requireAdmin() (defense in depth).
    if (!isApi) {
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if ((level?.currentLevel ?? 'aal1') < 'aal2') {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        loginUrl.searchParams.set('mfa', '1');
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Coming-soon: pages only (API responses must stay available, as before).
  if (!isApi) {
    let enabled = false;
    try {
      const adminClient = createAdminClient();
      const { data } = await adminClient
        .from('site_settings')
        .select('value')
        .eq('key', 'coming_soon_enabled')
        .single();
      enabled = data?.value === 'true';
    } catch {
      enabled = false;
    }

    const isComingSoonPage = pathname === '/coming-soon';
    if (isComingSoonPage) {
      if (enabled) return response;
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (enabled) return NextResponse.redirect(new URL('/coming-soon', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};