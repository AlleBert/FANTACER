'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { LocaleProvider } from '@/lib/LocaleContext'
import type { Locale } from '@/lib/locale'
import { CookieConsentUI } from '@/components/cookie-consent'
import { Analytics } from '@/components/analytics'
import { ConsentErrorBoundary } from '@/components/consent-error-boundary'

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <LocaleProvider locale={locale}>
      {isAdmin ? (
        children
      ) : (
        <ConsentErrorBoundary fallback={children}>
          {children}
          <Analytics />
          <CookieConsentUI />
        </ConsentErrorBoundary>
      )}
    </LocaleProvider>
  )
}
