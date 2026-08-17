import { test, expect } from '@playwright/test';
import { VIEWPORTS, type ViewportName } from './helpers/viewports';
import { setNavigationFailFast } from './helpers/navigation';
import { seedConsentCookie } from './helpers/cookie-consent';
import { it as itDict } from '../../src/i18n/it';

const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

const LEGAL_ROUTES = [
  { path: '/cookie-policy', titleKey: 'cookiePolicy.title' },
  { path: '/privacy-policy', titleKey: 'privacyPolicy.title' },
  { path: '/terms-and-conditions', titleKey: 'terms.title' },
] as const;

const AUDIT_VIEWPORTS: ViewportName[] = ['mobile-small', 'desktop'];

test.describe('Legal pages UI (P0 gate)', () => {
  // serial: evita instabilità WebKit con pagine parallele (connection refused)
  test.describe.configure({ mode: 'serial' });

  for (const vpName of AUDIT_VIEWPORTS) {
    const vp = VIEWPORTS[vpName];
    for (const route of LEGAL_ROUTES) {
      test(`${route.path} at ${vpName} (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
        test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
        test.setTimeout(60000);
        // prima richiesta a una rotta legale = compilazione cold di `next dev`
        setNavigationFailFast(page, 60000);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('load');
        await page.waitForTimeout(400);

        // h1 brand header
        const h1 = page.locator('#legal-content h1');
        await expect(h1).toHaveText(itDict[route.titleKey]);

        // contenuto su superficie bianca (contrasto sul foglio, non sul viola)
        const sheetBg = await page.locator('#legal-content').evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        expect(sheetBg, 'legal content must sit on a white surface').toBe('rgb(255, 255, 255)');

        // zero overflow orizzontale a livello documento (tabelle scrollano dentro il foglio)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `horizontal overflow ${overflow}px`).toBeLessThanOrEqual(1);

        // footer legale: bottone preferenze cookie + 3 link stessa scheda
        const footer = page.locator('section[data-section="legal"] footer');
        await expect(footer.getByRole('button', { name: itDict['footer.cookieConsent'] })).toBeVisible();
        const legalLinks = footer.locator(
          'a[href*="/cookie-policy"], a[href*="/privacy-policy"], a[href*="/terms-and-conditions"]'
        );
        expect(await legalLinks.count()).toBe(3);
        const sameTab = await legalLinks.evaluateAll((links) =>
          links.every((l) => l.getAttribute('target') === null)
        );
        expect(sameTab, 'legal footer links must NOT open in a new tab').toBe(true);
      });
    }
  }

  test('homepage footer links open in a new tab', async ({ page }, testInfo) => {
    test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
    setNavigationFailFast(page);
    await seedConsentCookie(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);
    const links = page.locator('#contact-section footer a[target="_blank"]');
    expect(await links.count()).toBe(3);
    const relOk = await links.evaluateAll((els) =>
      els.every((a) => (a.getAttribute('rel') ?? '').includes('noopener'))
    );
    expect(relOk).toBe(true);
  });
});