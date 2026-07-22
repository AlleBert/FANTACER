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
