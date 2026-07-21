import { type Page } from '@playwright/test';

export async function setupAdminForTest(page: Page) {
  await page.goto('/admin/dashboard/panoramica');
  await page.waitForLoadState('networkidle');
}
