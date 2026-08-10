import { type Page } from '@playwright/test';

export async function setupAdminForTest(page: Page, path?: string) {
  await page.goto(path || '/admin/dashboard/panoramica');
  await page.waitForLoadState('networkidle');
}