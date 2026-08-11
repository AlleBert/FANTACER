import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

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

function isAdminPage(pathname: string): boolean {
  return pathname.startsWith('/admin') && !pathname.startsWith('/api/');
}

function buildAdminCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function setSecurityHeaders(response: NextResponse, csp: string): void {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Nonce-based CSP for admin page responses. Next.js App Router extracts the
 * nonce from the CSP header on the REQUEST (not the response) and applies it
 * to its own inline scripts/styles during SSR. The request headers must be
 * propagated via `NextResponse.next({ request })` for the nonce to reach the
 * renderer; without this every inline script is blocked and the page renders
 * white. Cookies already set on the original response are preserved.
 */
function applyAdminPageHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const nonce = crypto.randomBytes(16).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = buildAdminCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const nextResponse = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of response.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    nextResponse.cookies.set(name, value, options);
  }
  setSecurityHeaders(nextResponse, csp);
  return nextResponse;
}

/**
 * Response-only security headers for redirects: no SSR happens on a 3xx, so
 * the nonce does not need to reach the renderer.
 */
function applyAdminResponseHeaders(response: NextResponse): void {
  const nonce = crypto.randomBytes(16).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';
  setSecurityHeaders(response, buildAdminCsp(nonce, isDev));
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
      const redirect = NextResponse.redirect(loginUrl);
      applyAdminResponseHeaders(redirect);
      return redirect;
    }

    // Risolve il ruolo degli admin_users (service role). Fail-closed:
    // lookup con errore o riga assente/inattiva ⇒ nessun accesso.
    let role: string | null = null;
    try {
      const adminClient = createAdminClient();
      const { data } = await adminClient
        .from('admin_users')
        .select('role')
        .eq('auth_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      role = data?.role ?? null;
    } catch {
      role = null;
    }

    if (role !== 'admin' && role !== 'viewer') {
      if (isApi) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      const redirect = NextResponse.redirect(loginUrl);
      applyAdminResponseHeaders(redirect);
      return redirect;
    }

    // Pages: admin renderizza solo a AAL2 (MFA obbligatoria); il passo MFA
    // avviene dentro /admin/login. I viewer sono ammessi a AAL1.
    // API handlers re-validano AAL/ruolo dentro requireAdmin() (defense in depth).
    if (!isApi && role === 'admin') {
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if ((level?.currentLevel ?? 'aal1') < 'aal2') {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        loginUrl.searchParams.set('mfa', '1');
        const redirect = NextResponse.redirect(loginUrl);
        applyAdminResponseHeaders(redirect);
        return redirect;
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

  if (isAdminPage(pathname)) {
    return applyAdminPageHeaders(request, response);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};