import { test, expect } from '@playwright/test';
import { hasAdminMfaCredentials, generateTotp } from './helpers/auth';
import { setNavigationFailFast } from './helpers/navigation';

/**
 * Regression gate — phantom client-side 500 nell'admin dashboard su mobile.
 *
 * Storia: su iOS WebKit con site-data bloccati (Safari private browsing,
 * "Prevent Cross-Site Tracking", in-app browser) `new WebSocket()` lancia una
 * SecurityError sincrona ("The operation is insecure.") dentro la subscribe
 * Realtime di Supabase → eccezione non gestita nei layout effects →
 * `global-error.tsx` → `<NextError statusCode={500}/>` (server 200).
 * L'utente "entrava" nella dashboard e dopo qualche istante vedeva il 500.
 * Fix: `safeSubscribe` (`src/lib/supabase/realtime.ts`) + `wss:` in connect-src.
 *
 * Auth via API (`page.request` condivide il cookie jar col browser context):
 * deterministico e indipendente dalla UI del login (su WebKit dev il submit UI
 * è flaky). Il test gira solo sui progetti WebKit.
 */

function blockLocalStorage() {
  try {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
      configurable: true,
    });
  } catch {
    /* già ridefinito o non ridefinibile */
  }
}

const WEBKIT_PROJECTS = ['mobile-webkit', 'ios-se', 'ios-iphone', 'ios-pro-max', 'ios-ipad-portrait'];

test('admin dashboard non deve produrre un 500 client-side con storage bloccati', async ({
  page,
}, testInfo) => {
  test.skip(!WEBKIT_PROJECTS.includes(testInfo.project.name), 'solo progetti WebKit mobile');
  test.skip(!hasAdminMfaCredentials(), 'richiede credenziali admin MFA');

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(`name=${err.name} message=${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.addInitScript(blockLocalStorage);
  setNavigationFailFast(page, 90_000);

  // 1. Login password → AAL1
  const login = await page.request.post('/api/admin/login', {
    data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  });
  const loginBody = await login.json();
  if (!login.ok || !loginBody.mfaRequired) {
    throw new Error(`Login fallito: ${login.status()} ${JSON.stringify(loginBody)}`);
  }

  // 2. Challenge MFA
  const challenge = await page.request.post('/api/admin/mfa/challenge', {
    data: { factorId: loginBody.factorId },
  });
  const challengeBody = await challenge.json();
  if (!challenge.ok) {
    throw new Error(`Challenge fallita: ${challenge.status()} ${JSON.stringify(challengeBody)}`);
  }

  // 3. Verify TOTP → AAL2
  const code = generateTotp(process.env.E2E_ADMIN_TOTP_SECRET as string);
  const verify = await page.request.post('/api/admin/mfa/verify', {
    data: { factorId: loginBody.factorId, challengeId: challengeBody.challengeId, code },
  });
  if (!verify.ok) {
    throw new Error(`Verify fallita: ${verify.status()} ${JSON.stringify(await verify.json())}`);
  }

  // 4. Dashboard: render iniziale + fetch async + subscribe realtime
  const response = await page.goto('/admin/dashboard/panoramica', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);

  await page.waitForTimeout(8_000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const phantom500 = /500|Internal Server Error|Internal Error/i.test(bodyText);

  const report = {
    url: page.url(),
    phantom500,
    securityErrorPageErrors: pageErrors.filter((e) => /SecurityError|The operation is insecure/i.test(e)),
    pageErrors,
    consoleErrors: consoleErrors.filter((c) => /SecurityError|WebSocket|insecure/i.test(c)),
    bodyTextPreview: bodyText.slice(0, 600),
  };

  console.log('=== PHANTOM-500 ADMIN START ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('=== PHANTOM-500 ADMIN END ===');

  expect(phantom500).toBe(false);
  expect(pageErrors.some((e) => /SecurityError|The operation is insecure/i.test(e))).toBe(false);
  // La dashboard deve essere davvero renderizzata (non un redirect/login).
  expect(bodyText).toContain('Panoramica');
});