import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { seedConsentCookie } from './helpers/cookie-consent'

test.describe.configure({ mode: 'serial' })

const GATE_PROJECTS = ['chromium']

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function testCompanyIds() {
  const supabase = adminClient()
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('batch', 'TEST')
    .limit(3)
  return (data || []).map((c) => c.id)
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name))
})

test.describe('Realtime — classifica e flag voto', () => {
  test('un evento ranking_tick reale innesca il refetch della classifica', async ({ page }) => {
    const ids = await testCompanyIds()
    test.skip(ids.length < 3, 'servono 3 aziende TEST nel dataset E2E')

    let rankingCalls = 0
    await page.route('**/api/public/ranking', async (route) => {
      rankingCalls += 1
      await route.continue()
    })

    await seedConsentCookie(page)
    await page.goto('/')

    const section = page.locator('main > section[data-section="live-ranking"]')
    await section.scrollIntoViewIfNeeded()

    // attende il primo fetch della classifica (sezione montata e dati caricati)
    await expect.poll(() => rankingCalls, { timeout: 15000 }).toBeGreaterThan(0)
    const before = rankingCalls

    // voto reale (service role) → trigger su ranking_tick → evento Realtime → refetch
    const supabase = adminClient()
    const { error } = await supabase.from('vote_sessions').insert({
      fingerprint: `e2e-rt-${Date.now()}`,
      company1_id: ids[0],
      company2_id: ids[1],
      company3_id: ids[2],
      country: 'IT',
      user_agent: 'e2e-rt',
    })
    expect(error).toBeNull()

    await expect.poll(() => rankingCalls, { timeout: 10000 }).toBeGreaterThan(before)
  })

  test('toggle voting_enabled via admin aggiorna la UI senza reload', async ({ page }) => {
    const supabase = adminClient()
    await seedConsentCookie(page)
    await page.goto('/')

    try {
      // spegne il voto → il provider riceve l'UPDATE e la ricerca mostra il blocco
      await supabase.from('site_settings').update({ value: 'false' }).eq('key', 'voting_enabled')
      await expect(page.getByText('Quanta fretta!')).toBeVisible({ timeout: 10000 })
    } finally {
      await supabase.from('site_settings').update({ value: 'true' }).eq('key', 'voting_enabled')
    }
  })
})
