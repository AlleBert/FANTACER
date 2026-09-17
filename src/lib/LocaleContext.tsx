'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { isLocale, LOCALE_COOKIE, type Locale } from '@/lib/locale'
import { translate, type DictionaryKey, type TParams } from '@/i18n'

interface LocaleContextValue {
  locale: Locale
  t: (key: DictionaryKey, params?: TParams) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
    const value = match ? decodeURIComponent(match[1]) : null
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

// Il cookie del locale viene impostato dal proxy e non cambia a runtime (nessun
// selettore lingua): non serve un vero subscribe.
const subscribe = () => () => {}

/**
 * Provider client-side del locale.
 *
 * Il root layout è statico (nessun accesso a cookie/header), quindi passa il
 * default 'it'. Il locale effettivo viene risolto qui dal cookie sticky
 * impostato dal proxy (derivato da Accept-Language). Durante l'hydration React
 * usa lo snapshot server (`initialLocale`), poi passa a quello client: nessun
 * mismatch di hydration. Con cookie assente/negato si resta sul default.
 */
export function LocaleProvider({ locale: initialLocale, children }: { locale: Locale; children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    () => readCookieLocale() ?? initialLocale,
    () => initialLocale,
  )

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    t: (key, params) => translate(locale, key, params),
  }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
