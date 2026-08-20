import { test, expect } from '@playwright/test';
import { setNavigationFailFast } from './helpers/navigation';

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

/**
 * Regression gate — phantom client-side 500 su mobile con site-data bloccati.
 *
 * Simula mobile browser con sito-data bloccati (Safari private browsing,
 * "Prevent Cross-Site Tracking", in-app browsers): `document.cookie` e
 * `window.localStorage` lanciano DOMException SecurityError.
 *
 * Storia: `readStoredConsent()` (cookie-consent.tsx), la libreria
 * `react-cookie-manager@5.3.0#getCookie()` e `@supabase/auth-js`
 * `_emitInitialSession` leggevano storage SENZA try/catch durante il render →
 * eccezione non gestita → `global-error.tsx` → `<NextError statusCode={500}/>`
 * con server che risponde 200. Fixati con try/catch (readStoredConsent),
 * `ConsentErrorBoundary` (providers) e `safeStorage`/`safeCookieMethods`
 * (supabase client).
 *
 * NON seediamo il consent cookie (vogliamo che il codice di lettura esegua).
 */

declare global {
  interface Window {
    __phantom500Repro?: { status: number | null; bodyText: string };
  }
}

function blockSiteData() {
  Object.defineProperty(document, 'cookie', {
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    set() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    configurable: true,
  });
  try {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
      configurable: true,
    });
  } catch {
    /* localStorage già ridefinito o non ridefinibile */
  }
}

test.setTimeout(120_000);

test('homepage non deve produrre un 500 client-side con site-data bloccati', async ({ page }) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`name=${err.name} message=${err.message} stack=${err.stack ?? 'n/a'}`);
  });

  await page.addInitScript(blockSiteData);

  setNavigationFailFast(page, 60_000);

  let status: number | null = null;
  let navFailed = false;
  let navError: string | null = null;
  try {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    status = response?.status() ?? null;
  } catch (err) {
    navFailed = true;
    navError = err instanceof Error ? err.message : String(err);
  }

  // Aspetta idratazione/render client + eventuale global-error
  await page.waitForTimeout(6_000);

  const bodyText = await page.evaluate(() =>
    document.body ? document.body.innerText : '',
  );

  const phantom500 = /500|Internal Server Error|Internal Error/i.test(bodyText);

  const report = {
    navigationFailed: navFailed,
    navError,
    httpStatus: status,
    phantom500Text: phantom500,
    bodyTextPreview: bodyText.slice(0, 1200),
    consoleMessages,
    pageErrors,
  };

  console.log('=== PHANTOM-500 REPRO START ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('=== PHANTOM-500 REPRO END ===');

  expect(status).toBe(200);
  expect(navFailed).toBe(false);
  expect(phantom500).toBe(false);
  expect(pageErrors.some((e) => /SecurityError/i.test(e))).toBe(false);
});