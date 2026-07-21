import { test } from '@playwright/test';
import { checkNoHorizontalOverflow } from './helpers/responsive';
import { VIEWPORTS } from './helpers/viewports';
import { checkAccessibility } from './helpers/accessibility';

test.describe('Admin Login — Responsive', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`no horizontal overflow at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/admin/login');
      await checkNoHorizontalOverflow(page);
    });
  }
});

test.describe('Admin Login — Accessibility', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('WCAG AA scan', async ({ page }) => {
    await page.goto('/admin/login');
    await checkAccessibility(page, {
      allowedViolations: [
        { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
        { id: 'color-contrast', reason: 'Dashboard header text uses brand orange (#ff8a26) on white — brand color, pending design system audit' },
      ],
    });
  });
});

test.describe('Admin Dashboard — Responsive', () => {
  test('panoramica page no horizontal overflow', async ({ page }) => {
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await checkNoHorizontalOverflow(page);
  });

  test('aziende page no horizontal overflow', async ({ page }) => {
    await page.goto('/admin/dashboard/aziende');
    await page.waitForLoadState('networkidle');
    await checkNoHorizontalOverflow(page);
  });

  test('voti page no horizontal overflow', async ({ page }) => {
    await page.goto('/admin/dashboard/voti');
    await page.waitForLoadState('networkidle');
    await checkNoHorizontalOverflow(page);
  });
});

test.describe('Admin Dashboard — Accessibility', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('panoramica WCAG AA scan', async ({ page }) => {
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await checkAccessibility(page, {
      allowedViolations: [
        { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
        { id: 'color-contrast', reason: 'Red negative values (text-red-500) and orange primary buttons — brand palette, pending design system audit' },
      ],
    });
  });
});
