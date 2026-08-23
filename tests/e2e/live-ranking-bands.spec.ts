import { test, expect } from '@playwright/test';
import { VIEWPORTS } from './helpers/viewports';
import { checkNoHorizontalOverflow } from './helpers/responsive';
import { seedConsentCookie } from './helpers/cookie-consent';

const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

// Azienda rank #1 del batch TEST (seed in tests/e2e/fixtures/test-data.ts):
// votes più alti di oggi (105) → sempre in TOP20, indipendente dai voti runtime.
const TOP20_COMPANY = 'Test Co';

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

test.describe('Live Ranking bands', () => {
  test('TOP 20 aperta con righe, fasce chiuse collassabili (aria-expanded)', async ({ page }) => {
    await seedConsentCookie(page);
    await page.goto('/');

    const section = page.locator('main > section[data-section="live-ranking"]');
    await section.scrollIntoViewIfNeeded();

    // TOP20 aperta di default: una riga reale visibile (evita lo skeleton)
    const topRow = section.getByText(TOP20_COMPANY).first();
    await expect(topRow).toBeVisible({ timeout: 15000 });

    // una fascia chiusa (GOLD) è un button collassato
    const goldButton = section.getByRole('button', { name: /GOLD/ }).first();
    await expect(goldButton).toBeVisible();
    await expect(goldButton).toHaveAttribute('aria-expanded', 'false');

    // click → si espande (asserzione di stato, niente timeout fisso)
    await goldButton.click();
    await expect(goldButton).toHaveAttribute('aria-expanded', 'true');

    await checkNoHorizontalOverflow(page);
  });
});

test.describe('Live Ranking bands — overflow per viewport', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`no overflow fascia at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedConsentCookie(page);
      await page.goto('/');

      const section = page.locator('main > section[data-section="live-ranking"]');
      await section.scrollIntoViewIfNeeded();

      // attende una riga renderizzata prima del check (evita lo skeleton)
      await expect(section.getByText(TOP20_COMPANY).first()).toBeVisible({ timeout: 15000 });
      await checkNoHorizontalOverflow(page);
    });
  }
});