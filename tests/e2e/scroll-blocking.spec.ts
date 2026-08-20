import { test, expect } from '@playwright/test';
import { completeVotingFlow } from './voting.helper';

const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

test.describe('Scroll Blocking Bug Fix', () => {
  test.describe.configure({ mode: 'serial', timeout: 60000 });

  test('TEST 1: Scroll funziona dalla sezione successo dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);

    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    const scrollHeight = await main.evaluate(el => el.scrollHeight);
    const clientHeight = await main.evaluate(el => el.clientHeight);

    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('TEST 2: Snap attivo dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);

    const mainClass = await page.locator('main').first().getAttribute('class');

    expect(mainClass).toContain('snap-y');
    expect(mainClass).toContain('snap-mandatory');
  });

  test('TEST 3: Nessun overlay bloccante dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);
    await page.waitForTimeout(1000);

    const fixedElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' &&
               style.pointerEvents !== 'none' &&
               style.visibility !== 'hidden' &&
               parseFloat(style.opacity) > 0;
      });
      return elements.map(el => ({
        tag: el.tagName,
        class: el.className.slice(0, 50),
        zIndex: window.getComputedStyle(el).zIndex,
        pointerEvents: window.getComputedStyle(el).pointerEvents
      }));
    });

    console.log('Fixed elements after vote:', fixedElements);

    const blockingOverlays = fixedElements.filter(el =>
      el.zIndex === '100' || el.zIndex === 'auto'
    );

    expect(blockingOverlays.length).toBe(0);
  });

  test('TEST 4: Success section visible dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);

    const successSection = page.locator('[data-section="success"]');
    await expect(successSection).toBeVisible();

    const heading = page.locator('h2:has-text("sei forte!")').first();
    await expect(heading).toBeVisible();
  });

  test('TEST 5: Scroll funziona su mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await completeVotingFlow(page);

    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    const scrollHeight = await main.evaluate(el => el.scrollHeight);
    const clientHeight = await main.evaluate(el => el.clientHeight);

    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('TEST 6: Snap su mobile funziona', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await completeVotingFlow(page);

    const mainClass = await page.locator('main').first().getAttribute('class');

    expect(mainClass).toContain('snap-y');
    expect(mainClass).toContain('snap-mandatory');
  });
});
