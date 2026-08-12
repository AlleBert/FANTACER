export type Locale = 'it' | 'en'

export const LOCALE_COOKIE = 'fantacer_locale'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 anno

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'it' || value === 'en'
}

/**
 * Estrae la lingua dal primo tag dell'Accept-Language. Solo 'en' viene
 * riconosciuta come inglese; ogni altro valore (o assenza) ricade su 'it'.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return 'it'
  const primary = acceptLanguage.split(',')[0]?.trim().split('-')[0]?.toLowerCase()
  return primary === 'en' ? 'en' : 'it'
}

/**
 * Cookie sticky: se il cookie è presente e valido ha precedenza;
 * altrimenti risolve dall'Accept-Language. Fallback finale: 'it'.
 */
export function resolveLocale(
  acceptLanguage: string | null | undefined,
  cookieValue: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue
  return matchLocale(acceptLanguage)
}
