'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Locale } from '@/lib/locale'
import { translate, type DictionaryKey, type TParams } from '@/i18n'

interface LocaleContextValue {
  locale: Locale
  t: (key: DictionaryKey, params?: TParams) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * Provider client-side: riceve il locale dal server (layout SSR) e lo espone
 * via context. Non determina né aggiorna la lingua lato client.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
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
