import { test, expect, type Page } from '@playwright/test';
import { seedConsentCookie } from './helpers/cookie-consent';

/**
 * Regressione identità di voto (collisioni FingerprintJS).
 *
 * L'identità ordinaria è un UUID first-party condiviso tra cookie e
 * localStorage. Due schede aperte contemporaneamente al primo accesso devono
 * convergere sulla stessa identità e usarla nel submit.
 */

const PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!PROJECTS.includes(testInfo.project.name));
});

async function addCompany(page: Page, companyName: string) {
  const searchInput = page.locator('input[placeholder*="Cerca"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.click();
  await searchInput.fill(companyName);
  const companyOption = page
    .locator('section[data-section="search"] ul li')
    .filter({ hasText: companyName })
    .first();
  await companyOption.waitFor({ state: 'visible', timeout: 10000 });
  await companyOption.click();

  const confermaButton = page.locator('button:has-text("CONFERMA")').first();
  await confermaButton.waitFor({ state: 'visible', timeout: 5000 });
  await confermaButton.click();
  await page.locator('#pallet-picker-title').waitFor({ state: 'hidden', timeout: 5000 });
}

async function selectThree(page: Page) {
  for (const name of ['Test Co', 'GreenEnergy', 'Third Co']) {
    await addCompany(page, name);
  }
}

test('due schede aperte insieme condividono la stessa identità e la usano nel voto', async ({
  context,
}) => {
  test.setTimeout(180_000);
  const [page1, page2] = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all([seedConsentCookie(page1), seedConsentCookie(page2)]);

  const submittedIds: string[] = [];
  for (const page of [page1, page2]) {
    await page.route('**/api/vota', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.voterId) submittedIds.push(body.voterId);
      await route.continue();
    });
  }

  // Primo accesso simultaneo: nessun cookie/localStorage nel context.
  await Promise.all([page1.goto('/'), page2.goto('/')]);

  const readId = (page: Page) => page.evaluate(() => localStorage.getItem('fantacer_voter_id'));

  await expect.poll(() => readId(page1), { timeout: 15000 }).not.toBeNull();
  await expect.poll(() => readId(page2), { timeout: 15000 }).not.toBeNull();

  const id1 = await readId(page1);
  const id2 = await readId(page2);
  expect(id1).toBe(id2);

  const cookie = (await context.cookies()).find((c) => c.name === 'fantacer_voter_id')?.value;
  expect(cookie).toBe(id1);

  // Entrambe arrivano al voto.
  await selectThree(page1);
  await selectThree(page2);

  const response1 = page1.waitForResponse('**/api/vota', { timeout: 30000 });
  await page1.locator('button:has-text("INVIA IL TUO VOTO")').first().click();
  await response1;

  const response2 = page2.waitForResponse('**/api/vota', { timeout: 30000 });
  await page2.locator('button:has-text("INVIA IL TUO VOTO")').first().click();
  await response2;

  expect(submittedIds.length).toBe(2);
  expect(submittedIds[0]).toBe(submittedIds[1]);
  expect(submittedIds[0]).toBe(id1);
});
