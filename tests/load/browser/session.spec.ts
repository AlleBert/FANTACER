import { expect, test, type BrowserContext } from '@playwright/test'
import { addCompany, submitVote } from '../../e2e/voting.helper'

const SESSIONS = Number(process.env.LOAD_BROWSER_SESSIONS || 5)
const CONSENT_COOKIE = 'fantacer_cookie_consent'

function originFrom(baseURL: string | undefined): string {
  return new URL(baseURL || 'http://localhost:3000').origin
}

async function seedConsent(context: BrowserContext, origin: string) {
  await context.addCookies([{ name: CONSENT_COOKIE, value: '{}', url: origin }])
}

test.describe('mini-run browser reali', () => {
  test('N sessioni concorrenti: heartbeat + ranking', async ({ browser, baseURL }) => {
    const origin = originFrom(baseURL)
    const contexts = await Promise.all(
      Array.from({ length: SESSIONS }, () => browser.newContext({ baseURL })),
    )

    try {
      await Promise.all(
        contexts.map(async (context, i) => {
          await seedConsent(context, origin)
          const page = await context.newPage()

          const heartbeat = page.waitForResponse(
            (r) => r.url().includes('/api/presence/heartbeat') && r.status() === 200,
            { timeout: 30000 },
          )
          const ranking = page.waitForResponse(
            (r) => r.url().includes('/api/public/ranking') && r.status() === 200,
            { timeout: 30000 },
          )

          await page.goto('/')

          const hb = await heartbeat
          expect(hb.status(), `sessione ${i}: heartbeat`).toBe(200)

          await page.locator('main > section[data-section="live-ranking"]').scrollIntoViewIfNeeded()
          const rk = await ranking
          expect(rk.status(), `sessione ${i}: ranking`).toBe(200)

          await context.close()
        }),
      )
    } finally {
      await Promise.all(contexts.map((c) => c.close().catch(() => {})))
    }
  })

  test('voto end-to-end via UI', async ({ page, baseURL }) => {
    const origin = originFrom(baseURL)
    await seedConsent(page.context(), origin)

    const res = await page.request.get('/api/aziende?limit=6')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { data?: Array<{ name: string }> }
    const names = (body.data || []).map((c) => c.name)
    test.skip(names.length < 3, 'aziende insufficienti per il flusso di voto')

    await page.goto('/')
    for (const name of names.slice(0, 3)) {
      await addCompany(page, name)
    }
    await submitVote(page)
    await expect(page.locator('[data-section="success"]')).toBeVisible()
  })
})
