'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  readConsentCookie,
  writeConsentCookie,
  subscribeConsentStore,
  type DetailedCookieConsent,
} from '@/lib/consent-cookie'

const UNKNOWN = Symbol('unknown-consent')
type Unknown = typeof UNKNOWN
type Stored = DetailedCookieConsent | null | Unknown

function getSnapshot(): Stored {
  return readConsentCookie()
}

function getServerSnapshot(): Stored {
  return UNKNOWN
}

/**
 * Sostituto leggero di useCookieConsent (react-cookie-manager).
 * Espone la stessa superficie usata da CookieConsentUI e Analytics, con lo
 * stesso formato cookie, senza la libreria (≈112 kB gzip risparmiati).
 */
export function useCookieConsent() {
  const consent = useSyncExternalStore<Stored>(
    subscribeConsentStore,
    getSnapshot,
    getServerSnapshot
  )

  const acceptCookies = useCallback(() => {
    writeConsentCookie({
      Analytics: { consented: true, timestamp: new Date().toISOString() },
    })
  }, [])

  const declineCookies = useCallback(() => {
    writeConsentCookie({
      Analytics: { consented: false, timestamp: new Date().toISOString() },
    })
  }, [])

  const updateDetailedConsent = useCallback(
    (draft: { Analytics: boolean; Social: boolean; Advertising: boolean }) => {
      const now = new Date().toISOString()
      writeConsentCookie({
        Analytics: { consented: draft.Analytics, timestamp: now },
        Social: { consented: draft.Social, timestamp: now },
        Advertising: { consented: draft.Advertising, timestamp: now },
      })
    },
    []
  )

  return {
    // Durante SSR/hydration il valore è UNKNOWN; lato client è il consenso letto.
    detailedConsent: consent === UNKNOWN ? null : consent,
    acceptCookies,
    declineCookies,
    updateDetailedConsent,
  }
}