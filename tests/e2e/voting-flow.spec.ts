import { test, expect } from '@playwright/test';
import { addCompany } from './voting.helper';
import { checkNoHorizontalOverflow } from './helpers/responsive';
import { VIEWPORTS } from './helpers/viewports';
import { checkAccessibility } from './helpers/accessibility';

const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

test.describe('Voting Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('complete voting flow: search 3 companies, assign pallets, submit', async ({ page }) => {
    await page.goto('/');

    await addCompany(page, 'Test Co');
    await addCompany(page, 'GreenEnergy');
    await addCompany(page, 'Third Co');

    const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
    await expect(inviaButton).toBeEnabled();
    await inviaButton.click();

    await page.waitForSelector('[data-section="success"]', { timeout: 15000 });
    const successSection = page.locator('[data-section="success"]');
    await expect(successSection).toBeVisible();
  });

  test('dopo il voto la sezione ranking evidenzia le aziende votate', async ({ page }) => {
    await page.goto('/');
    await addCompany(page, 'Test Co');
    await addCompany(page, 'GreenEnergy');
    await addCompany(page, 'Third Co');
    const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
    await inviaButton.click();
    await page.waitForSelector('[data-section="success"]', { timeout: 15000 });

    const rankingSection = page.locator('main > section[data-section="live-ranking"]');
    const rankingResponse = page.waitForResponse('/api/public/ranking', { timeout: 20000 });
    await rankingSection.scrollIntoViewIfNeeded();
    await rankingResponse;
    await expect(rankingSection).toBeVisible();

    // le aziende votate hanno il badge "il tuo voto" nella loro fascia
    const badges = rankingSection.getByText(/il tuo voto/).first();
    await expect(badges).toBeVisible({ timeout: 10000 });
  });

  test('sponsor cards stay within their section bounds at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await addCompany(page, 'Test Co');
    await addCompany(page, 'GreenEnergy');
    await addCompany(page, 'Third Co');

    const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
    await expect(inviaButton).toBeEnabled();
    await inviaButton.click();

    // Il voto è andato a buon fine…
    await page.waitForSelector('[data-section="success"]', { timeout: 15000 });
    // …e le sponsor card (sezione public-ranking, non più dentro success) non
    // devono eccedere i bordi della loro sezione.
    await page.waitForSelector('[data-section="public-ranking"] [style*="--sponsor-size"]', { timeout: 15000 });

    const overflows = await page.locator('[data-section="public-ranking"]').evaluate((section) => {
      const sr = section.getBoundingClientRect();
      const offenders: { text: string; overflowBy: number; axis: string }[] = [];
      const cards = Array.from(section.querySelectorAll<HTMLElement>('a, div')).filter((el) =>
        el.style.getPropertyValue('--sponsor-size'),
      );
      for (const card of cards) {
        const cr = card.getBoundingClientRect();
        if (cr.right > sr.right + 2) {
          offenders.push({
            text: (card.textContent ?? '').trim().slice(0, 40),
            overflowBy: Math.round(cr.right - sr.right),
            axis: 'right',
          });
        }
        if (cr.bottom > sr.bottom + 2) {
          offenders.push({
            text: (card.textContent ?? '').trim().slice(0, 40),
            overflowBy: Math.round(cr.bottom - sr.bottom),
            axis: 'bottom',
          });
        }
      }
      return offenders;
    });

    expect(overflows, JSON.stringify(overflows, null, 2)).toEqual([]);
  });

  test('submit button disabled when fewer than 3 companies selected', async ({ page }) => {
    await page.goto('/');
    const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
    await expect(inviaButton).toBeDisabled();

    await addCompany(page, 'Test Co');
    await expect(inviaButton).toBeDisabled();

    await addCompany(page, 'GreenEnergy');
    await expect(inviaButton).toBeDisabled();
  });
});

test.describe('Voting Flow — Responsive', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`no horizontal overflow at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await checkNoHorizontalOverflow(page);
    });
  }
});

test.describe('Voting Flow — Accessibility', () => {
  test('homepage WCAG AA scan', async ({ page }) => {
    await page.goto('/');
    await checkAccessibility(page, {
      allowedViolations: [],
    });
  });
});
