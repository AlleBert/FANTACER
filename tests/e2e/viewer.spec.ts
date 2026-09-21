/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use `use` as a callback, not a React hook */
import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  loginAsViewer,
  hasViewerCredentials,
  hasAdminMfaCredentials,
  loginAsAdminWithMfa,
} from './helpers/auth';

const needsViewer = () => test.skip(!hasViewerCredentials(), 'E2E viewer credentials not configured');

/**
 * Viewer role (AAL1, read-only): logs in without MFA, reaches the same
 * dashboard/nav, but every administrative WRITE and the privileged export
 * return 403 (enforced server-side by requireRoleAdmin).
 *
 * Un solo login viewer per worker (storageState condiviso): il rate-limit
 * di login (10/15min per IP+email) impedisce di ri-autenticarsi per ogni
 * singolo test.
 */
type ViewerWorkerFixtures = {
  viewerState: Awaited<ReturnType<BrowserContext['storageState']>>;
};

type ViewerFixtures = {
  viewerPage: Page;
  viewerRequest: APIRequestContext;
};

const test = base.extend<ViewerFixtures, ViewerWorkerFixtures>({
  viewerState: [
    async ({ browser }: { browser: Browser }, use) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await loginAsViewer(page);
      const state = await ctx.storageState();
      await ctx.close();
      await use(state);
    },
    { scope: 'worker' },
  ],
  viewerPage: async ({ browser, viewerState }, use) => {
    const ctx = await browser.newContext({ storageState: viewerState });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  viewerRequest: async ({ browser, viewerState }, use) => {
    const ctx = await browser.newContext({ storageState: viewerState });
    await use(ctx.request);
    await ctx.close();
  },
});

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

test.describe('Viewer role (read-only)', () => {
  needsViewer();

  test('logs in without an MFA prompt and reaches the dashboard', async ({ viewerPage: page }) => {
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/admin\/dashboard\/panoramica/);

    const mfaStep = page.locator('input[placeholder="000000"]');
    await expect(mfaStep).toHaveCount(0);
  });

  test('/api/admin/me reports role=viewer', async ({ viewerRequest: request }) => {
    const res = await request.get('/api/admin/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('viewer');
  });

  test('sidebar shows the same sections', async ({ viewerPage: page }) => {
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('aside nav, nav[aria-label="Navigazione principale"]');
    const texts = await nav.allTextContents();
    const text = texts.join('\n');
    for (const section of ['Panoramica', 'Aziende', 'Voti', 'Sponsor', 'Import', 'Impostazioni']) {
      expect(text.toLowerCase()).toContain(section.toLowerCase());
    }
  });

  for (const [label, method, url, body] of [
    ['sponsors POST', 'post', '/api/admin/sponsors', { name: 'should-not-persist' }],
    ['sponsors PUT', 'put', '/api/admin/sponsors', { id: '00000000-0000-0000-0000-000000000000' }],
    ['sponsors DELETE', 'delete', '/api/admin/sponsors?id=00000000-0000-0000-0000-000000000000', undefined],
    ['batch POST', 'post', '/api/admin/batch', { activeBatch: 'TEST' }],
    ['batch DELETE', 'delete', '/api/admin/batch', { batchName: 'TEST' }],
    ['companies/import POST', 'post', '/api/admin/companies/import', undefined],
    ['settings/coming-soon PUT', 'put', '/api/admin/settings/coming-soon', { enabled: false }],
  ] as const) {
    test(`write gate → ${label} returns 403 for viewer`, async ({ viewerRequest: request }) => {
      const res = await requestWith(request, method, url, body);
      expect(res.status()).toBe(403);
    });
  }

  test('analytics export is admin-only (403 for viewer)', async ({ viewerRequest: request }) => {
    const res = await request.get('/api/analytics?type=export&format=csv');
    expect(res.status()).toBe(403);
  });

  test('bundle export is admin-only (403 for viewer)', async ({ viewerRequest: request }) => {
    const res = await request.get('/api/analytics?type=bundle&format=csv');
    expect(res.status()).toBe(403);
  });

  test('admin still reaches dashboard with MFA (sanity)', async ({ page }) => {
    test.skip(!hasAdminMfaCredentials(), 'E2E admin MFA credentials not configured');
    await loginAsAdminWithMfa(page);
    await page.goto('/admin/dashboard/panoramica');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/admin\/dashboard\/panoramica/);
  });
});

async function requestWith(
  request: APIRequestContext,
  method: string,
  url: string,
  body: unknown,
): Promise<Awaited<ReturnType<APIRequestContext['post']>>> {
  const opts: { data?: unknown } = body === undefined ? {} : { data: body };
  switch (method) {
    case 'post':
      return request.post(url, opts);
    case 'put':
      return request.put(url, opts);
    case 'delete':
      return request.delete(url, opts);
    default:
      throw new Error(`Unsupported method ${method}`);
  }
}
