import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { seedConsentCookie } from './helpers/cookie-consent';

/**
 * Scenari di voto end-to-end con la nuova identità UUID first-party.
 *
 * Copre: collisione tra device (stesso visitorId, UUID diversi), voto ripetuto,
 * concorrenza sullo stesso UUID, voto di ieri, confine giornata Europe/Rome +
 * DST, refresh/ripristino, recupero cookie<->localStorage.
 *
 * Tutte le scritture avvengono sul progetto E2E (`fantacer-e2e`).
 */

const BASE = 'http://localhost:3000';
const VOTER_COOKIE = 'fantacer_voter_id';
const PROJECTS = ['chromium'];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing e2e Supabase credentials');
  return createClient(url, key, { auth: { persistSession: false } });
}

let companyIds: string[] = [];

test.beforeAll(async () => {
  const supabase = admin();
  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .eq('batch', 'TEST')
    .in('name', ['Test Co', 'GreenEnergy', 'Third Co']);
  if (error || !data || data.length < 3) {
    throw new Error(`Test companies not found: ${error?.message ?? 'missing'}`);
  }
  companyIds = data.map((c) => c.id as string);
});

test.beforeEach(async ({}, testInfo) => {
  test.skip(!PROJECTS.includes(testInfo.project.name));
});

test.afterEach(async () => {
  const supabase = admin();
  await supabase.from('vote_sessions').delete().like('fingerprint', 'v1:%');
});

async function newContextWithCookie(browser: Browser, voterId: string) {
  const context = await browser.newContext({ baseURL: BASE });
  await context.addCookies([{ name: VOTER_COOKIE, value: voterId, url: BASE }]);
  return context;
}

function voteBody(visitorId: string, voterId: string) {
  return {
    company1Id: companyIds[0],
    company2Id: companyIds[1],
    company3Id: companyIds[2],
    turnstile_token: 'e2e-token',
    botd: '',
    visitorId,
    voterId,
  };
}

async function postVote(context: BrowserContext, voterId: string, visitorId: string) {
  return context.request.post('/api/vota', { data: voteBody(visitorId, voterId) });
}

test.describe('Voting scenarios — identità UUID', () => {
  test.describe.configure({ mode: 'serial' });

  test('stesso visitorId con UUID diversi: entrambi votano (collisione risolta)', async ({
    browser,
  }) => {
    const visitorId = 'same-fingerprint-e2e';
    const a = randomUUID();
    const b = randomUUID();

    const ctxA = await newContextWithCookie(browser, a);
    const ctxB = await newContextWithCookie(browser, b);
    const resA = await postVote(ctxA, a, visitorId);
    const resB = await postVote(ctxB, b, visitorId);

    expect(resA.status()).toBe(200);
    expect(resB.status()).toBe(200);

    const { data } = await admin()
      .from('vote_sessions')
      .select('fingerprint')
      .in('fingerprint', [`v1:${a}`, `v1:${b}`]);
    expect(new Set((data ?? []).map((r) => r.fingerprint))).toEqual(
      new Set([`v1:${a}`, `v1:${b}`]),
    );

    await ctxA.close();
    await ctxB.close();
  });

  test('stesso UUID: il primo voto riesce, il secondo è rifiutato', async ({ browser }) => {
    const voterId = randomUUID();
    const context = await newContextWithCookie(browser, voterId);

    const first = await postVote(context, voterId, 'visitor-repeat');
    const second = await postVote(context, voterId, 'visitor-repeat');

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toContain('già votato');

    const { data } = await admin()
      .from('vote_sessions')
      .select('fingerprint')
      .eq('fingerprint', `v1:${voterId}`);
    expect(data).toHaveLength(1);

    await context.close();
  });

  test('richieste concorrenti stesso UUID: un solo voto registrato', async ({ browser }) => {
    const voterId = randomUUID();
    const context = await newContextWithCookie(browser, voterId);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postVote(context, voterId, 'visitor-concurrent')),
    );
    const statuses = responses.map((r) => r.status());

    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);

    const { data } = await admin()
      .from('vote_sessions')
      .select('fingerprint')
      .eq('fingerprint', `v1:${voterId}`);
    expect(data).toHaveLength(1);

    await context.close();
  });

  test('voto di ieri: oggi lo stesso UUID può rivotare', async ({ browser }) => {
    const voterId = randomUUID();
    const fingerprint = `v1:${voterId}`;

    await admin()
      .from('vote_sessions')
      .insert({
        fingerprint,
        company1_id: companyIds[0],
        company2_id: companyIds[1],
        company3_id: companyIds[2],
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });

    const context = await newContextWithCookie(browser, voterId);
    const res = await postVote(context, voterId, 'visitor-next-day');
    expect(res.status()).toBe(200);

    const { data } = await admin()
      .from('vote_sessions')
      .select('vote_day')
      .eq('fingerprint', fingerprint);
    expect(new Set((data ?? []).map((r) => r.vote_day)).size).toBe(2);

    await context.close();
  });

  test('confine giornata Europe/Rome e DST sul valore vote_day', async () => {
    const fingerprint = `v1:${randomUUID()}`;
    const cases: Array<[string, string]> = [
      ['2026-09-21T21:59:00Z', '2026-09-21'],
      ['2026-09-21T22:00:00Z', '2026-09-22'],
      ['2026-03-29T00:30:00Z', '2026-03-29'], // primavera: CET -> CEST
      ['2026-10-25T00:30:00Z', '2026-10-25'], // autunno, ancora CEST
      ['2026-10-25T23:30:00Z', '2026-10-26'], // autunno, dopo il fall-back è CET (UTC+1)
    ];

    const supabase = admin();
    const { error } = await supabase.from('vote_sessions').insert(
      cases.map(([createdAt]) => ({
        fingerprint,
        company1_id: companyIds[0],
        company2_id: companyIds[1],
        company3_id: companyIds[2],
        created_at: createdAt,
      })),
    );
    expect(error).toBeNull();

    const { data } = await supabase
      .from('vote_sessions')
      .select('created_at, vote_day')
      .eq('fingerprint', fingerprint);

    const byCreated = new Map(
      (data ?? []).map((r) => [
        new Date(r.created_at as string).toISOString(),
        r.vote_day as string,
      ]),
    );
    for (const [createdAt, expectedDay] of cases) {
      const iso = new Date(createdAt).toISOString();
      expect(byCreated.get(iso), `vote_day per ${createdAt}`).toBe(expectedDay);
    }
  });
});

test.describe('Voting scenarios — UI identità e ripristino', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test('refresh/riapertura: UUID stabile e stato ripristinato', async ({ browser }) => {
    const voterId = randomUUID();
    await admin()
      .from('vote_sessions')
      .insert({
        fingerprint: `v1:${voterId}`,
        company1_id: companyIds[0],
        company2_id: companyIds[1],
        company3_id: companyIds[2],
        created_at: new Date().toISOString(),
      });

    const context = await newContextWithCookie(browser, voterId);
    const page = await context.newPage();
    await seedConsentCookie(page);
    await page.goto('/');

    await expect(page.locator('[data-section="success"]')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => localStorage.getItem('fantacer_voter_id'))).toBe(voterId);

    await page.reload();
    await expect(page.locator('[data-section="success"]')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => localStorage.getItem('fantacer_voter_id'))).toBe(voterId);

    await context.close();
  });

  test('cookie assente ma localStorage valido: recupera e riscrive il cookie', async ({
    browser,
  }) => {
    const voterId = randomUUID();
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await page.addInitScript((id) => {
      window.localStorage.setItem('fantacer_voter_id', id);
    }, voterId);
    await seedConsentCookie(page);
    await page.goto('/');

    await expect
      .poll(
        () =>
          page.evaluate(
            (id) => document.cookie.includes(`fantacer_voter_id=${id}`),
            voterId,
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('fantacer_voter_id'))).toBe(voterId);

    await context.close();
  });

  test('cookie valido ma localStorage assente: riscrive localStorage', async ({ browser }) => {
    const voterId = randomUUID();
    const context = await newContextWithCookie(browser, voterId);
    const page = await context.newPage();
    await seedConsentCookie(page);
    await page.goto('/');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('fantacer_voter_id')), { timeout: 15000 })
      .toBe(voterId);

    await context.close();
  });
});
