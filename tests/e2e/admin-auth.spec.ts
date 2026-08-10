import { test, expect } from '@playwright/test';

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
});