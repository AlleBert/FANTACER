import { test } from '@playwright/test';
import { checkAccessibility, type AllowedViolation } from './helpers/accessibility';
import { hasAdminMfaCredentials, setupAdminForTest } from './helpers/auth';

const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

const ROUTES: { path: string; allowedViolations: AllowedViolation[] }[] = [
  { path: '/', allowedViolations: [] },
  { path: '/coming-soon', allowedViolations: [] },
  {
    path: '/admin/login',
    allowedViolations: [
      { id: 'color-contrast', reason: 'Dashboard header text uses brand orange (#ff8a26) on white — brand color, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/panoramica',
    allowedViolations: [
      { id: 'color-contrast', reason: 'Red negative values (text-red-500) and orange primary buttons — brand palette, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/aziende',
    allowedViolations: [
      { id: 'color-contrast', reason: 'Orange primary buttons in batch selector — brand palette, pending design system audit' },
    ],
  },
  {
    path: '/admin/dashboard/voti',
    allowedViolations: [
      { id: 'color-contrast', reason: 'Orange primary active nav link (bg-primary on brand orange) and red destructive card title (text-red-500) — brand palette, pending design system audit' },
    ],
  },
];

test.describe('Cross-Route Accessibility Scan', () => {
  for (const route of ROUTES) {
    test(`WCAG AA scan: ${route.path}`, async ({ page }) => {
      test.skip(route.path.startsWith('/admin/dashboard') && !hasAdminMfaCredentials(),
        'E2E admin MFA credentials not configured');
      if (route.path.startsWith('/admin/dashboard')) {
        await setupAdminForTest(page, route.path);
      } else {
        await page.goto(route.path);
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await checkAccessibility(page, {
        allowedViolations: route.allowedViolations,
      });
    });
  }
});
