export const COOKIE_CONSENT_KEY = 'fantacer_cookie_consent'

export interface ConsentStatus {
  consented: boolean
  timestamp: string
}

export type DetailedCookieConsent = {
  Analytics: ConsentStatus
  Social: ConsentStatus
  Advertising: ConsentStatus
}

const emptyConsent: DetailedCookieConsent = {
  Analytics: { consented: false, timestamp: new Date(0).toISOString() },
  Social: { consented: false, timestamp: new Date(0).toISOString() },
  Advertising: { consented: false, timestamp: new Date(0).toISOString() },
}

/**
 * Legge il cookie di consenso in modo no-throw. Su browser con site-data
 * bloccati (Safari private browsing, "Prevent Cross-Site Tracking") l'accesso
 * a `document.cookie` lancia SecurityError: restituisce null invece di crasare.
 * La cache sul raw value rende getSnapshot stabile per useSyncExternalStore.
 */
let cachedRaw: string | null = null
let cachedValue: DetailedCookieConsent | null = null

const listeners = new Set<() => void>()

export function subscribeConsentStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function readConsentCookie(): DetailedCookieConsent | null {
  if (typeof window === 'undefined') return null
  let row: string | undefined
  try {
    row = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_CONSENT_KEY}=`))
  } catch {
    return null
  }
  const raw = row ? row.slice(COOKIE_CONSENT_KEY.length + 1) : null
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  cachedValue = null
  if (!raw) return null
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    /* valore non encodato */
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') {
        cachedValue = {
          Analytics: {
            consented: !!parsed.Analytics?.consented,
            timestamp: parsed.Analytics?.timestamp ?? new Date(0).toISOString(),
          },
          Social: {
            consented: !!parsed.Social?.consented,
            timestamp: parsed.Social?.timestamp ?? new Date(0).toISOString(),
          },
          Advertising: {
            consented: !!parsed.Advertising?.consented,
            timestamp: parsed.Advertising?.timestamp ?? new Date(0).toISOString(),
          },
        }
        break
      }
    } catch {
      /* formato non valido */
    }
  }
  return cachedValue
}

export function writeConsentCookie(consent: Partial<DetailedCookieConsent>): void {
  if (typeof window === 'undefined') return
  const existing = readConsentCookie() ?? emptyConsent
  const next: DetailedCookieConsent = {
    Analytics: consent.Analytics ?? existing.Analytics,
    Social: consent.Social ?? existing.Social,
    Advertising: consent.Advertising ?? existing.Advertising,
  }
  try {
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
      JSON.stringify(next)
    )};path=/;max-age=31536000;samesite=lax`
  } catch {
    /* storage bloccato: ignora */
  }
  cachedRaw = null
  cachedValue = null
  listeners.forEach((listener) => listener())
}
