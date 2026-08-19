import { createBrowserClient } from '@supabase/ssr'
import type { CookieMethodsBrowser } from '@supabase/ssr'
import { parse, serialize } from 'cookie'

/**
 * Storage adapter (localStorage-backed) that never throws on storage access.
 *
 * Su browser mobile con storage bloccato (Safari private browsing, "Prevent
 * Cross-Site Tracking", in-app browser) l'accesso a `localStorage` lancia
 * `SecurityError: The operation is insecure.`. Ogni metodo è protetto da
 * try/catch e degrada senza eccezioni (null / no-op), anche in SSR.
 */
export const safeStorage = {
  getItem(name: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem(name: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // storage bloccato: ignora
    }
  },
  removeItem(name: string): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch {
      // storage bloccato: ignora
    }
  },
}

/**
 * Cookie accessors che non lanciano mai su accesso a `document.cookie`.
 *
 * `createBrowserClient` costruisce lo storage di auth da questi metodi
 * (sovrascrive `auth.storage` con uno storage basato su cookie), quindi è qui
 * che va protetto l'accesso a `document.cookie` per evitare la `SecurityError`
 * con site data bloccati. `auth.storage` resta comunque passato come fallback
 * difensivo per versioni future della libreria.
 */
export const safeCookieMethods: CookieMethodsBrowser = {
  getAll() {
    try {
      return Object.entries(parse(document.cookie)).map(([name, value]) => ({
        name,
        value: value ?? '',
      }))
    } catch {
      return []
    }
  },
  setAll(cookies) {
    for (const { name, value, options } of cookies) {
      try {
        document.cookie = serialize(name, value, options)
      } catch {
        // storage bloccato: ignora
      }
    }
  },
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: safeStorage,
      },
      cookies: safeCookieMethods,
    }
  )
}