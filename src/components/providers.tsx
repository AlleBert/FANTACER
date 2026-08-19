'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { CookieManager } from 'react-cookie-manager'
import { LocaleProvider } from '@/lib/LocaleContext'
import type { Locale } from '@/lib/locale'
import { CookieConsentUI, COOKIE_CATEGORIES, COOKIE_CONSENT_KEY } from '@/components/cookie-consent'
import { Analytics } from '@/components/analytics'

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <LocaleProvider locale={locale}>
      {isAdmin ? (
        children
      ) : (
        <CookieManager
          cookieKey={COOKIE_CONSENT_KEY}
          displayType="modal"
          disableAutomaticBlocking
          cookieCategories={COOKIE_CATEGORIES}
          initialPreferences={{ Analytics: false, Social: false, Advertising: false }}
        >
          {children}
          <Analytics />
          <CookieConsentUI />
        </CookieManager>
      )}
    </LocaleProvider>
  )
}
