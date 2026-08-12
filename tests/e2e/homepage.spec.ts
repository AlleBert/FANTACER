import { test, expect } from '@playwright/test';
import { checkNoHorizontalOverflow, checkNoTextClipping, checkInteractiveElementsReachable } from './helpers/responsive';
import { VIEWPORTS } from './helpers/viewports';
import { checkAccessibility } from './helpers/accessibility';

test.describe('Homepage — Responsive', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`${name} (${viewport.width}x${viewport.height})`, () => {
      test.use({ viewport });

      test('no horizontal overflow', async ({ page }) => {
        await page.goto('/');
        await checkNoHorizontalOverflow(page);
      });

      test('no text clipping in main content', async ({ page }) => {
        await page.goto('/');
        await checkNoTextClipping(page, 'main');
      });

      test('interactive elements are reachable', async ({ page }) => {
        await page.goto('/');
        await checkInteractiveElementsReachable(page);
      });
    });
  }
});

test.describe('Homepage — Screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['chromium', 'mobile-webkit'].includes(testInfo.project.name),
      'Visual regression on Chromium + Mobile WebKit only',
    );
  });

  test('hero section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hero = page.locator('section').first();
    await expect(hero).toHaveScreenshot('hero-desktop.png');
  });

  test('search section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const searchSection = page.locator('section').filter({ hasText: /Cerca|Azienda|Company|Search/i }).first();

    await searchSection.scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');

    await expect(searchSection).toHaveScreenshot('search-section-desktop.png');
  });
});

test.describe('Homepage — Accessibility', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('WCAG AA scan', async ({ page }) => {
    await page.goto('/');
    await checkAccessibility(page, {
      allowedViolations: [],
    });
  });
});
