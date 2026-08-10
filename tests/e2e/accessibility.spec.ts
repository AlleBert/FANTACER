import { test } from '@playwright/test';
import { checkAccessibility, type AllowedViolation } from './helpers/accessibility';
import { hasAdminCredentials } from './helpers/auth';

const ROUTES: { path: string; allowedViolations: AllowedViolation[] }[] = [
  { path: '/', allowedViolations: [] },
  { path: '/coming-soon', allowedViolations: [] },
  {
    path: '/admin/login',
    allowedViolations: [
      { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
      { id: 'color-contrast', reason: 'Dashboard header text uses brand orange (#ff8a26) on white — brand color, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/panoramica',
    allowedViolations: [
      { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
      { id: 'color-contrast', reason: 'Red negative values (text-red-500) and orange primary buttons — brand palette, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/aziende',
    allowedViolations: [
      { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
      { id: 'color-contrast', reason: 'Orange primary buttons in batch selector — brand palette, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/voti',
    allowedViolations: [
      { id: 'button-name', reason: 'Sidebar collapse/expand toggle icon button in AdminLayout — no visible text, upstream component' },
    ],
  },
];

test.describe('Cross-Route Accessibility Scan', () => {
  for (const route of ROUTES) {
    test(`WCAG AA scan: ${route.path}`, async ({ page }) => {
      test.skip(route.path.startsWith('/admin/dashboard') && !hasAdminCredentials(),
        'E2E admin credentials not configured');
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await checkAccessibility(page, {
        allowedViolations: route.allowedViolations,
      });
    });
  }
});
