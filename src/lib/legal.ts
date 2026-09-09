import { cookies, headers } from 'next/headers'
import { dictionaries } from '@/i18n'
import { LOCALE_COOKIE, resolveLocale, type Locale } from '@/lib/locale'
import type { DictionaryKey } from '@/i18n/dictionary'

export async function getLegalLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  return resolveLocale(
    headerStore.get('accept-language') ?? null,
    cookieStore.get(LOCALE_COOKIE)?.value ?? null,
  )
}

export function makeLegalT(locale: Locale) {
  const dict = dictionaries[locale]
  return (key: DictionaryKey, params?: Record<string, string>): string => {
    let text = dict[key]
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v)
      }
    }
    return text
  }
}
