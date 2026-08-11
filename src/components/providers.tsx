'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { CookieManager, type TranslationObject } from 'react-cookie-manager'
import { LocaleProvider } from '@/lib/LocaleContext'
import type { Locale } from '@/lib/locale'
import { dictionaries, type Dictionary } from '@/i18n'

function cookieTranslations(dict: Dictionary): TranslationObject {
  return {
    title: dict['cookie.title'],
    message: dict['cookie.message'],
    buttonText: dict['cookie.buttonText'],
    declineButtonText: dict['cookie.declineButtonText'],
    manageButtonText: dict['cookie.manageButtonText'],
    manageTitle: dict['cookie.manageTitle'],
    manageMessage: dict['cookie.manageMessage'],
    manageEssentialTitle: dict['cookie.essentialTitle'],
    manageEssentialSubtitle: dict['cookie.essentialSubtitle'],
    manageEssentialStatus: dict['cookie.essentialStatus'],
    manageAnalyticsTitle: dict['cookie.analyticsTitle'],
    manageAnalyticsSubtitle: dict['cookie.analyticsSubtitle'],
    manageSocialTitle: dict['cookie.socialTitle'],
    manageSocialSubtitle: dict['cookie.socialSubtitle'],
    manageAdvertTitle: dict['cookie.advertTitle'],
    manageAdvertSubtitle: dict['cookie.advertSubtitle'],
    manageSaveButtonText: dict['cookie.saveButtonText'],
    manageCancelButtonText: dict['cookie.cancelButtonText'],
  }
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <LocaleProvider locale={locale}>
      {isAdmin ? (
        children
      ) : (
        <CookieManager
          cookieKey="fantacer_cookie_consent"
          translations={cookieTranslations(dictionaries[locale])}
          displayType="modal"
          theme="light"
          showManageButton={false}
          cookieCategories={{ Analytics: true, Social: false, Advertising: false }}
          initialPreferences={{ Analytics: false, Social: false, Advertising: false }}
        >
          {children}
        </CookieManager>
      )}
    </LocaleProvider>
  )
}
