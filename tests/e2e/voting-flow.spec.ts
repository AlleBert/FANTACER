import { test, expect } from '@playwright/test';

test.describe('Voting Flow', () => {
  test('complete voting flow: search company, comment, adjective, sliders, submit', async ({ page }) => {
    await page.goto('/');

    // Section 1: Search and select company
    await page.fill('input[placeholder="Cerca azienda..."]', 'Test Co');
    await page.waitForSelector('li:has-text("Test Co")');
    await page.click('li:has-text("Test Co")');
    await page.click('button:has-text("Next")');

    // Section 2: Write comment
    await page.fill('textarea[placeholder="PERCHÉ...?"]', 'Great company!');
    await page.click('button:has-text("Next")');

    // Section 3: Select adjective
    await page.click('button:has-text("eccezionale")');
    await page.click('button:has-text("Next")');

    // Section 4: Adjust sliders and submit
    const sliders = await page.$$('input[type="range"]');
    for (const slider of sliders) {
      await slider.fill('80');
    }
    await page.click('button:has-text("FATTO!")');

    // Should show success section
    await expect(page.locator('text=/success/i')).toBeVisible();
  });

  test('Next button disabled when no company selected', async ({ page }) => {
    await page.goto('/');
    const nextButton = page.locator('button:has-text("Next")').first();
    await expect(nextButton).toBeDisabled();
  });

  test('Mobile: voting flow on iPhone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Same test as above, validates mobile responsive
    await page.goto('/');

    // Section 1: Search and select company
    await page.fill('input[placeholder="Cerca azienda..."]', 'Test Co');
    await page.waitForSelector('li:has-text("Test Co")');
    await page.click('li:has-text("Test Co")');
    await page.click('button:has-text("Next")');

    // Section 2: Write comment
    await page.fill('textarea[placeholder="PERCHÉ...?"]', 'Great company!');
    await page.click('button:has-text("Next")');

    // Section 3: Select adjective
    await page.click('button:has-text("eccezionale")');
    await page.click('button:has-text("Next")');

    // Section 4: Adjust sliders and submit
    const sliders = await page.$$('input[type="range"]');
    for (const slider of sliders) {
      await slider.fill('80');
    }
    await page.click('button:has-text("FATTO!")');

    // Should show success section
    await expect(page.locator('text=/success/i')).toBeVisible();
  });
});
