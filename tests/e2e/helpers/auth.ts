import { type Page } from '@playwright/test';

export async function setupAdminForTest(page: Page, path?: string) {
  await page.addInitScript(() => {
    localStorage.setItem('admin_session', 'dev-bypass-token');
  });
  await page.goto(path || '/admin/dashboard/panoramica');
  await page.waitForLoadState('networkidle');
}
