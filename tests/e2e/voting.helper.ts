import { type Page, expect } from '@playwright/test';

const DEFAULT_COMPANIES = ['Test Co', 'GreenEnergy', 'Third Co'];

export async function searchAndSelectCompany(page: Page, companyName: string) {
  const searchInput = page.locator('input[placeholder*="Cerca"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.click();
  await searchInput.fill(companyName);
  await page.waitForTimeout(1500);
  const resultsList = page.locator('ul').first();
  await resultsList.waitFor({ state: 'visible', timeout: 10000 });
  const companyOption = resultsList.locator(`li`).filter({ hasText: companyName }).first();
  await companyOption.waitFor({ state: 'visible', timeout: 5000 });
  await companyOption.click();
}

export async function confirmPallet(page: Page) {
  const confermaButton = page.locator('button:has-text("CONFERMA")').first();
  await confermaButton.waitFor({ state: 'visible', timeout: 5000 });
  await confermaButton.click();
  await page.waitForTimeout(500);
}

export async function addCompany(page: Page, companyName: string) {
  await searchAndSelectCompany(page, companyName);
  await confirmPallet(page);
}

export async function selectThreeCompanies(page: Page, companies?: string[]) {
  const names = companies || DEFAULT_COMPANIES;
  for (const name of names) {
    await addCompany(page, name);
  }
}

export async function submitVote(page: Page) {
  const inviaButton = page.locator('button:has-text("INVIA IL TUO VOTO")').first();
  await expect(inviaButton).toBeEnabled({ timeout: 5000 });
  await inviaButton.click();

  await page.waitForSelector('[data-section="success"]', { timeout: 15000 });
  await page.waitForTimeout(500);
}

export async function completeVotingFlow(page: Page, companies?: string[]) {
  await page.goto('/');
  await selectThreeCompanies(page, companies);
  await submitVote(page);
}
