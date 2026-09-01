'use client'

import { GoogleAnalytics } from '@next/third-parties/google'
import { useCookieConsent } from '@/lib/cookie-consent-core'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/**
 * GA4 caricato solo dopo il consenso alla categoria Analytics (GDPR).
 * Con GA_ID assente o consenso non ancora espresso non monta nulla:
 * nessuno script di terze parti precaricato senza consenso.
 */
export function Analytics() {
  const { detailedConsent } = useCookieConsent()
  const analyticsConsented = detailedConsent?.Analytics?.consented === true

  if (!GA_ID || !analyticsConsented) return null

  return <GoogleAnalytics gaId={GA_ID} />
}