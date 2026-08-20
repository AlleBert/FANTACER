import { test, expect } from '@playwright/test';
import { VIEWPORTS } from './helpers/viewports';
import { checkNoHorizontalOverflow } from './helpers/responsive';
import { seedConsentCookie } from './helpers/cookie-consent';

test.describe('Live Ranking bands', () => {
  test.describe.configure({ mode: 'serial' });

  test('TOP 20 visibile, GOLD/SILVER/BRONZE collassabili senza overflow', async ({ page }) => {
    await seedConsentCookie(page);
    await page.goto('/');
    await page.waitForResponse('/api/public/ranking', { timeout: 20000 });

    const section = page.locator('main > section[data-section="live-ranking"]');
    await section.scrollIntoViewIfNeeded();

    // la TOP 20 è aperta di default (mostra almeno una riga con punteggio)
    await expect(section.getByText('TOP 20').first()).toBeVisible();

    // le altre fasce sono collassate (header visibile, righe non visibili)
    const goldBand = section.getByText('GOLD', { exact: false }).first();
    await expect(goldBand).toBeVisible();

    // clicca per espandere la GOLD
    await goldBand.click();
    await page.waitForTimeout(400);

    // nessun overflow orizzontale nella pagina
    await checkNoHorizontalOverflow(page);
  });

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`no overflow fascia at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForResponse('/api/public/ranking', { timeout: 20000 });
      const section = page.locator('main > section[data-section="live-ranking"]');
      await section.scrollIntoViewIfNeeded();
      await checkNoHorizontalOverflow(page);
    });
  }
});