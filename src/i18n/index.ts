import type { Locale } from '@/lib/locale'
import type { Dictionary, DictionaryKey } from './dictionary'
import { it } from './it'
import { en } from './en'

export type { Dictionary, DictionaryKey } from './dictionary'

export const dictionaries: Record<Locale, Dictionary> = { it, en }

export interface TParams {
  count?: string | number
}

/**
 * Risolve una chiave del dizionario per il locale dato, con interpolazione
 * dei segnaposto `{param}` presenti nel testo.
 */
export function translate(
  locale: Locale,
  key: DictionaryKey,
  params?: TParams,
): string {
  let text = dictionaries[locale][key]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export { it, en }
