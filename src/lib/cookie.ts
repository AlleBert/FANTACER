const CONSENT_COOKIE_NAME = 'fantacer_consent'

export interface ConsentData {
  necessary: boolean
  analytics: boolean
  timestamp: string
}

function parseCookie(cookieString: string | null): ConsentData | null {
  if (!cookieString) return null
  try {
    return JSON.parse(cookieString)
  } catch {
    return null
  }
}

export function getConsent(): ConsentData | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CONSENT_COOKIE_NAME) {
      return parseCookie(value)
    }
  }
  return null
}

export function setConsent(consent: ConsentData): void {
  if (typeof document === 'undefined') return
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${CONSENT_COOKIE_NAME}=${JSON.stringify(consent)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

export function hasConsented(): boolean {
  if (typeof document === 'undefined') return false
  const cookieConsent = getConsent()
  if (cookieConsent) return true
  const localConsent = localStorage.getItem('fantacer_consent')
  if (localConsent) return true
  return false
}

export function getAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  const consent = getConsent()
  if (consent) return consent.analytics
  const localConsent = localStorage.getItem('fantacer_consent')
  if (localConsent) {
    try {
      return JSON.parse(localConsent).analytics
    } catch {
      return false
    }
  }
  return false
}
