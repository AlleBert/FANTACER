import { test, expect } from '@playwright/test';
import {
  hasAdminCredentials,
  hasAdminMfaCredentials,
  loginAsAdminWithMfa,
  generateTotp,
} from './helpers/auth';

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

test.describe('Admin security', () => {
  test('admin API returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/admin/votes');
    expect(res.status()).toBe(401);
  });

  test('analytics API returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/analytics?type=summary');
    expect(res.status()).toBe(401);
  });

  test('admin mutations return 401 without session', async ({ request }) => {
    const res = await request.post('/api/admin/sponsors', {
      data: { name: 'should-not-persist' },
    });
    expect(res.status()).toBe(401);
  });

  test('fake bearer token is rejected', async ({ request }) => {
    const res = await request.get('/api/admin/companies', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status()).toBe(401);
  });

  test('dashboard page redirects to login without session', async ({ page }) => {
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForURL('**/admin/login**');
    expect(page.url()).toContain('/admin/login');
  });

  test('homepage and public APIs remain reachable without session', async ({ request }) => {
    const res = await request.get('/api/public/batch');
    expect(res.status()).toBe(200);
  });

  test('admin without MFA factor is blocked with mfa_not_configured', async ({ request }) => {
    test.skip(!hasAdminCredentials() || hasAdminMfaCredentials(),
      'E2E admin has MFA configured — mfa_not_configured case needs an admin without a verified factor');

    const res = await request.post('/api/admin/login', {
      data: {
        email: process.env.E2E_ADMIN_EMAIL,
        password: process.env.E2E_ADMIN_PASSWORD,
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('mfa_not_configured');
  });

  test('admin with MFA factor completes challenge+verify', async ({ page }) => {
    test.skip(!hasAdminMfaCredentials(), 'E2E admin MFA credentials not configured');

    await loginAsAdminWithMfa(page);
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/admin\/dashboard\/panoramica/);
  });

  test('/api/admin/me returns role for authenticated admin', async ({ page }) => {
    test.skip(!hasAdminMfaCredentials(), 'E2E admin MFA credentials not configured');

    await loginAsAdminWithMfa(page);
    const res = await page.request.get('/api/admin/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('admin');
    expect(body.email).toBe(process.env.E2E_ADMIN_EMAIL);
  });

  test('generateTotp produces a 6-digit code from the enrolled secret', () => {
    test.skip(!process.env.E2E_ADMIN_TOTP_SECRET, 'E2E_ADMIN_TOTP_SECRET not configured');
    const code = generateTotp(process.env.E2E_ADMIN_TOTP_SECRET as string);
    expect(code).toMatch(/^\d{6}$/);
  });
});