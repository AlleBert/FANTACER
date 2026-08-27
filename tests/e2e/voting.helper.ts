import { type Page, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { seedConsentCookie } from './helpers/cookie-consent';

const DEFAULT_COMPANIES = ['Test Co', 'GreenEnergy', 'Third Co'];

/**
 * Il fingerprint di voto (`FingerprintJS.visitorId`) è stabile per browser
 * instance: test paralleli/sequenziali nello stesso worker condividono lo stesso
 * visitorId e la RPC `submit_vote` rifiuta il secondo voto ("Hai già votato oggi"
 * → 409). Qui il `visitorId` del payload `/api/vota` viene riscritto con un UUID
 * unico per test: ogni voto E2E simula un visitatore distinto, senza toccare il
 * percorso reale (Turnstile, BotD, RPC) e senza pulizie DB a runtime.
 */
const voteRouteStubbed = new WeakSet<Page>();

export async function stubUniqueVoteFingerprint(page: Page) {
  if (voteRouteStubbed.has(page)) return;
  await page.route('**/api/vota', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    body.visitorId = `e2e-voter-${randomUUID()}`;
    await route.continue({ postData: JSON.stringify(body) });
  });
  voteRouteStubbed.add(page);
}

export async function searchAndSelectCompany(page: Page, companyName: string) {
  await seedConsentCookie(page);
  await stubUniqueVoteFingerprint(page);
  const searchInput = page.locator('input[placeholder*="Cerca"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.click();
  await searchInput.fill(companyName);
  // La ricerca è debounced (300ms) + query Supabase client-side (non una fetch
  // URL attendibile via waitForResponse). La condizione funzionale è l'opzione
  // azienda che compare nei risultati: si aspetta direttamente quell'elemento
  // (polling fino a 10s), niente timeout fisso che sotto carico è insufficiente.
  // Scoping alla sezione search: `ul li` nudo matcha anche le righe della
  // classifica live (che contengono gli stessi nomi seedati). Sotto carico la
  // classifica renderizza prima dei risultati di ricerca → il click colpiva la
  // riga sbagliata e il modale pallet non si apriva.
  const companyOption = page
    .locator('section[data-section="search"] ul li')
    .filter({ hasText: companyName })
    .first();
  await companyOption.waitFor({ state: 'visible', timeout: 10000 });
  await companyOption.click();
}

export async function confirmPallet(page: Page) {
  const confermaButton = page.locator('button:has-text("CONFERMA")').first();
  await confermaButton.waitFor({ state: 'visible', timeout: 5000 });
  await confermaButton.click();
  // Il picker pallet (ModalShell, id pallet-picker-title) resta montato per il
  // fade-out CSS (EXIT_FADE_MS ~220ms) e si smonta dopo: attenderne la chiusura
  // è la condizione funzionale della conferma, niente timeout fisso.
  await page.locator('#pallet-picker-title').waitFor({ state: 'hidden', timeout: 5000 });
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

  await page.waitForSelector('[data-section="success"]', { timeout: 30000 });
}

export async function completeVotingFlow(page: Page, companies?: string[]) {
  await seedConsentCookie(page);
  await page.goto('/');
  await selectThreeCompanies(page, companies);
  await submitVote(page);
}
