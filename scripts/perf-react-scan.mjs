/* Standalone performance analysis: aggregates react-scan onRender metrics per component. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function scrollWholePage(page) {
  await page.evaluate(async () => {
    const main = document.querySelector('main');
    if (!main) return;
    const step = Math.max(400, Math.floor(main.scrollHeight / 8));
    for (let y = 0; y <= main.scrollHeight; y += step) {
      main.scrollTop = y;
      await new Promise((r) => setTimeout(r, 150));
    }
    main.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 150));
  });
}

async function scrollToSection(page, sel) {
  await page.evaluate(async (s) => {
    const main = document.querySelector('main');
    const t = main?.querySelector(s);
    if (main && t) main.scrollTo({ top: t.offsetTop, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
  }, sel);
}

async function readLog(page) {
  return page.evaluate(() => {
    const agg = {};
    for (const e of window.__renderLog || []) {
      if (!agg[e.name]) agg[e.name] = { count: 0, timeMs: 0 };
      agg[e.name].count += e.n;
      agg[e.name].timeMs += e.t;
    }
    const out = Object.entries(agg).map(([name, v]) => ({
      name,
      count: v.count,
      timeMs: Math.round(v.timeMs * 1000) / 1000,
    }));
    out.sort((a, b) => b.count - a.count || b.timeMs - a.timeMs);
    return out;
  });
}

/**
 * Colleziona le metriche react-scan eseguendo un journey utente reale.
 * @returns {Promise<object>} report per-stadio { label: [{name,count,timeMs}] }
 */
export async function collect(baseUrl = BASE, outPath = null) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: 'fantacer_cookie_consent', value: '{}', url: baseUrl }]);
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      window.__renderLog = [];
      if (typeof window.reactScan === 'function') {
        window.reactScan({
          onRender: (fiber, renders) => {
            const t = fiber && fiber.type;
            const name = (t && (t.displayName || t.name)) || 'Anonymous';
            window.__renderLog.push({
              name,
              n: renders ? renders.length : 0,
              t: renders && renders[0] ? renders[0].time : 0,
            });
          },
        });
      }
    });

    const report = {};
    const stage = async (label, fn) => {
      await fn();
      await page.waitForTimeout(200);
      report[label] = await readLog(page);
    };

    await stage('afterLoad', async () => {});
    await stage('afterScroll', () => scrollWholePage(page));
    await stage('afterSearch', async () => {
      await scrollToSection(page, '[data-section="search"]');
      const input = page.locator('input[type="text"]').first();
      if (await input.count()) {
        await input.click();
        await input.fill('azienda');
        await page.waitForTimeout(1200);
      }
    });
    await stage('afterSelect', async () => {
      const result = page.locator('main ul li').first();
      if (await result.count()) {
        await result.click();
        await page.waitForTimeout(500);
      }
    });
    await stage('afterResizeMobile', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(700);
    });
    await stage('afterResizeBack', async () => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(500);
    });

    if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
    return report;
  } finally {
    await browser.close();
  }
}