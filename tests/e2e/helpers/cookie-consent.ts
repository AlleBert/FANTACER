import { type Page } from '@playwright/test';

export const COOKIE_CONSENT_NAME = 'fantacer_cookie_consent';

/**
 * Pre-imposta il cookie di consenso PRIMA del load della pagina.
 *
 * Il banner cookie (`CookieConsentUI`) mostra quando `view === null && !hasConsent`
 * (vedi `src/components/cookie-consent.tsx`). Con il cookie presente il banner non
 * renderizza mai → screenshot puliti e zero attese per il dismiss.
 * Il valore `{}` è quello che scriveva `acceptCookies` quando tutte le
 * categorie opzionali erano disattive: `readConsentCookie()` (consent-cookie
 * core) lo interpreta come consenso dato con categorie false → banner nascosto.
 */
export async function seedConsentCookie(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: COOKIE_CONSENT_NAME,
      value: '{}',
      // `url` deriva domain (localhost) e path (/), come richiesto da addCookies
      url: 'http://localhost:3000',
    },
  ]);
}
