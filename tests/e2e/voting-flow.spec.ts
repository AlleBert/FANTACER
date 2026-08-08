import { test, expect } from '@playwright/test';
import { addCompany } from './voting.helper';
import { checkNoHorizontalOverflow } from './helpers/responsive';
import { VIEWPORTS } from './helpers/viewports';
import { checkAccessibility } from './helpers/accessibility';

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

  test('sponsor cards stay within the success section bounds at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await addCompany(page, 'Test Co');
    await addCompany(page, 'GreenEnergy');
    await addCompany(page, 'Third Co');

    const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
    await expect(inviaButton).toBeEnabled();
    await inviaButton.click();

    await page.waitForSelector('[data-section="success"]', { timeout: 15000 });
    await page.waitForSelector('[data-section="success"] .aspect-square', { timeout: 15000 });

    const overflows = await page.locator('[data-section="success"]').evaluate((section) => {
      const sr = section.getBoundingClientRect();
      const offenders: { text: string; overflowBy: number; axis: string }[] = [];
      for (const card of section.querySelectorAll<HTMLElement>('.aspect-square')) {
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
