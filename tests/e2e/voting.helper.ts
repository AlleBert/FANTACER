import { type Page, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { seedConsentCookie } from './helpers/cookie-consent';

const DEFAULT_COMPANIES = ['Test Co', 'GreenEnergy', 'Third Co'];

/**
 * L'identità di voto è ora un UUID first-party (`fantacer_voter_id`) in cookie
 * e localStorage, non più il `FingerprintJS.visitorId`. Per simulare un
 * visitatore distinto per test si impone un UUID unico su cookie + localStorage
 * prima del submit: il server risolve l'identità dal cookie (precedenza) e la
 * RPC `submit_vote` usa la chiave `v1:<uuid>`.
 */
const voterIdStubbed = new WeakSet<Page>();

export async function stubUniqueVoterId(page: Page) {
  if (voterIdStubbed.has(page)) return;
  const voterId = randomUUID();
  const origin = new URL(page.url()).origin;

  await page.context().addCookies([
    { name: 'fantacer_voter_id', value: voterId, url: origin },
  ]);
  await page.addInitScript((id) => {
    try {
      window.localStorage.setItem('fantacer_voter_id', id);
    } catch {
      // storage non disponibile: il cookie resta l'identità
    }
  }, voterId);

  voterIdStubbed.add(page);
}

/** Alias retro-compatibile: l'identità non è più il fingerprint. */
export const stubUniqueVoteFingerprint = stubUniqueVoterId;

export async function searchAndSelectCompany(page: Page, companyName: string) {
  await seedConsentCookie(page);
  await stubUniqueVoterId(page);
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
