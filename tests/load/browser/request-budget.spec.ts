import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Mini-run browser — budget delle richieste di rete.
 *
 * Quantifica i guadagni client-side del branch (non visibili a k6, che usa i
 * propri timing e non esegue il browser):
 * - SponsorCards è montato 3 volte (intro, public-ranking, live-ranking footer)
 *   ma la fetch è condivisa a livello modulo → 1 sola richiesta per pageview
 *   (pre-branch: 3).
 * - Polling classifica ogni 30s (pre-branch: 10s) e heartbeat ogni 90s
 *   (pre-branch: 30s).
 * - Una sola WebSocket per scheda (`@supabase/ssr` singleton).
 *
 * Scrive `loadtest-output/browser-<ts>/requests.json` (gitignored) per il
 * confronto before/after. Le assert usano budget con slack: il test è anche un
 * guard di non-regressione.
 *
 * Env:
 *   LOAD_BASE_URL        base URL app sotto test (default http://localhost:3000)
 *   LOAD_BROWSER_SESSIONS numero di sessioni concorrenti (default 3)
 *   LOAD_OBSERVE_MS       finestra di osservazione polling/ranking (default 35000)
 *   LOAD_OBSERVE_LONG=1   abilita il test lento (~95s) su heartbeat/cadenze
 */

const SESSIONS = Number(process.env.LOAD_BROWSER_SESSIONS || 3)
const OBSERVE_MS = Number(process.env.LOAD_OBSERVE_MS || 35000)
const OBSERVE_LONG = process.env.LOAD_OBSERVE_LONG === '1'
const CONSENT_COOKIE = 'fantacer_cookie_consent'

const TRACKED_ENDPOINTS = [
  '/api/public/sponsors',
  '/api/public/ranking',
  '/api/public/batch',
  '/api/public/flag/voting',
  '/api/presence/heartbeat',
  '/api/vota/status',
  '/api/vota',
] as const

type Endpoint = (typeof TRACKED_ENDPOINTS)[number]

interface SessionCounts {
  session: number
  counts: Partial<Record<Endpoint, number>>
  websockets: number
}

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_DIR = join(process.cwd(), 'loadtest-output', `browser-${RUN_STAMP}`)
const report: {
  baseUrl: string | null
  sessions: number
  observeMs: number
  phases: Record<string, unknown>
} = { baseUrl: null, sessions: SESSIONS, observeMs: OBSERVE_MS, phases: {} }

function flushReport(): void {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'requests.json'), JSON.stringify(report, null, 2))
}

function endpointOf(url: string): Endpoint | null {
  try {
    const { pathname } = new URL(url)
    return TRACKED_ENDPOINTS.find((p) => p === pathname) ?? null
  } catch {
    return null
  }
}

function track(page: Page): SessionCounts {
  const counts: Partial<Record<Endpoint, number>> = {}
  const session: SessionCounts = { session: 0, counts, websockets: 0 }
  page.on('request', (req) => {
    const ep = endpointOf(req.url())
    if (ep) counts[ep] = (counts[ep] ?? 0) + 1
  })
  page.on('websocket', () => {
    session.websockets += 1
  })
  return session
}

async function openSession(
  browser: Browser,
  baseURL: string | undefined,
  index: number,
): Promise<{ page: Page; tracked: SessionCounts; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL })
  await context.addCookies([{ name: CONSENT_COOKIE, value: '{}', url: new URL(baseURL || 'http://localhost:3000').origin }])
  const page = await context.newPage()
  const tracked = track(page)
  tracked.session = index
  return { page, tracked, close: () => context.close() }
}

/** Attende che l'idratazione abbia emesso almeno una fetch "di boot". */
async function waitForBoot(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (r) => {
        const ep = endpointOf(r.url())
        return ep === '/api/public/batch' || ep === '/api/public/flag/voting'
      },
      { timeout: 15000 },
    )
    .catch(() => {})
  // Lascia completare le altre fetch iniziali (sponsor, ranking mount, heartbeat).
  await page.waitForTimeout(2500)
}

test.describe('budget richieste browser', () => {
  test('pageload: sponsor condivisi e una sola fetch per endpoint', async ({ browser, baseURL }) => {
    report.baseUrl = baseURL ?? null
    const sessions = await Promise.all(
      Array.from({ length: SESSIONS }, (_, i) => openSession(browser, baseURL, i)),
    )
    try {
      await Promise.all(
        sessions.map(async ({ page }) => {
          await page.goto('/')
          await waitForBoot(page)
        }),
      )
    } finally {
      await Promise.all(sessions.map((s) => s.close().catch(() => {})))
    }

    const results = sessions.map((s) => s.tracked)
    report.phases.pageload = results
    flushReport()

    for (const { session, counts, websockets } of results) {
      expect(counts['/api/public/sponsors'] ?? 0, `sessione ${session}: sponsor fetch (cache condivisa)`).toBe(1)
      expect(counts['/api/public/batch'] ?? 0, `sessione ${session}: batch`).toBe(1)
      expect(counts['/api/public/flag/voting'] ?? 0, `sessione ${session}: flag voto`).toBeLessThanOrEqual(2)
      expect(counts['/api/presence/heartbeat'] ?? 0, `sessione ${session}: heartbeat iniziale`).toBe(1)
      expect(counts['/api/vota/status'] ?? 0, `sessione ${session}: status senza voto salvato`).toBe(0)
      expect(websockets, `sessione ${session}: una sola WebSocket`).toBeLessThanOrEqual(1)
    }
  })

  test('polling ranking: nessuna raffica nella finestra breve', async ({ browser, baseURL }) => {
    report.baseUrl = baseURL ?? null
    const sessions = await Promise.all(
      Array.from({ length: SESSIONS }, (_, i) => openSession(browser, baseURL, i)),
    )

    const before: Record<number, Partial<Record<Endpoint, number>>> = {}
    try {
      await Promise.all(
        sessions.map(async ({ page, tracked }) => {
          await page.goto('/')
          await waitForBoot(page)
          await page.locator('main > section[data-section="live-ranking"]').scrollIntoViewIfNeeded()
          // Il fetch d'ingresso in viewport è parte del budget "iniziale".
          await page.waitForTimeout(1500)
          before[tracked.session] = { ...tracked.counts }
        }),
      )

      await Promise.all(sessions.map(({ page }) => page.waitForTimeout(OBSERVE_MS)))
    } finally {
      await Promise.all(sessions.map((s) => s.close().catch(() => {})))
    }

    const results = sessions.map((s) => {
      const start = before[s.tracked.session] ?? {}
      const total = (ep: Endpoint) => s.tracked.counts[ep] ?? 0
      const delta = (ep: Endpoint) => total(ep) - (start[ep] ?? 0)
      return {
        session: s.tracked.session,
        rankingTotal: total('/api/public/ranking'),
        rankingInWindow: delta('/api/public/ranking'),
        heartbeatTotal: total('/api/presence/heartbeat'),
        heartbeatInWindow: delta('/api/presence/heartbeat'),
        websockets: s.tracked.websockets,
      }
    })
    report.phases.polling = results
    flushReport()

    for (const r of results) {
      // Primario: nella finestra (~35s) al massimo 1 poll (30s). Con il vecchio
      // intervallo a 10s sarebbero ~3.
      expect(r.rankingInWindow, `sessione ${r.session}: poll ranking nella finestra`).toBeLessThanOrEqual(1)
      // Nessun heartbeat nella finestra: il secondo scatta a 90s (vecchio: 30s).
      expect(r.heartbeatInWindow, `sessione ${r.session}: heartbeat nella finestra`).toBe(0)
      // Guard largo sul totale (mount + IntersectionObserver + poll).
      expect(r.rankingTotal, `sessione ${r.session}: ranking totali`).toBeLessThanOrEqual(5)
      expect(r.websockets, `sessione ${r.session}: una sola WebSocket`).toBeLessThanOrEqual(1)
    }
  })

  test('cadenze lunghe (~95s): heartbeat 90s e polling 30s', async ({ browser, baseURL }) => {
    test.skip(!OBSERVE_LONG, 'Imposta LOAD_OBSERVE_LONG=1 per eseguire il test lento (~95s).')
    test.setTimeout(180_000)

    report.baseUrl = baseURL ?? null
    const session = await openSession(browser, baseURL, 0)
    let start: Partial<Record<Endpoint, number>> = {}
    try {
      await session.page.goto('/')
      await waitForBoot(session.page)
      await session.page.locator('main > section[data-section="live-ranking"]').scrollIntoViewIfNeeded()
      await session.page.waitForTimeout(1500)
      start = { ...session.tracked.counts }
      await session.page.waitForTimeout(95_000)
    } finally {
      await session.close().catch(() => {})
    }

    const total = (ep: Endpoint) => session.tracked.counts[ep] ?? 0
    const delta = (ep: Endpoint) => total(ep) - (start[ep] ?? 0)
    const heartbeatInWindow = delta('/api/presence/heartbeat')
    const rankingInWindow = delta('/api/public/ranking')
    report.phases.longWindow = {
      heartbeatInWindow,
      rankingInWindow,
      heartbeatTotal: total('/api/presence/heartbeat'),
      rankingTotal: total('/api/public/ranking'),
      websockets: session.tracked.websockets,
    }
    flushReport()

    // Heartbeat a 90s → 1 nella finestra (vecchio intervallo 30s → ~3).
    expect(heartbeatInWindow, 'heartbeat nella finestra ~95s').toBeGreaterThanOrEqual(1)
    expect(heartbeatInWindow, 'heartbeat nella finestra ~95s').toBeLessThanOrEqual(2)
    // Poll a 30/60/90 → 3 (vecchio 10s → ~9).
    expect(rankingInWindow, 'poll ranking nella finestra ~95s').toBeLessThanOrEqual(4)
  })
})
