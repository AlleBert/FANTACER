import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { auditAllSections } from './helpers/section-audit';
import { seedConsentCookie } from './helpers/cookie-consent';
import { setNavigationFailFast } from './helpers/navigation';

/**
 * Audit iOS — modalità viewport/chrome stress.
 *
 * Applica viewport ridotte e condizioni estreme (URL bar visibile, viewport
 * basse, strette, landscape) per stressare il layout senza assumere che la
 * viewport mobile visibile sia sempre una dimensione statica.
 *
 * Rispetto agli audit decisionali, QUESTO audit usa assert: una sezione che non
 * sta nello spazio disponibile (micro-scroll / clipping / overflow) fa fallire
 * il test. Eseguito solo sui progetti `ios-*` con `VISUAL_IOS_MODAL=1`.
 */
const IOS_PROJECTS = [
  'ios-se',
  'ios-iphone',
  'ios-pro-max',
  'ios-ipad-portrait',
  'ios-ipad-landscape',
  'ios-ipad-pro-portrait',
  'ios-ipad-pro-landscape',
];

const REPORT_ROOT = 'tests/e2e/visual-audit-homepage-ios/chrome-stress';
const SCREENSHOT_DIR = join(REPORT_ROOT, 'screenshots');

interface StressCase {
  name: string;
  width: number;
  height: number;
}

function buildStressCases(baseW: number, baseH: number): StressCase[] {
  const cases: StressCase[] = [
    { name: 'urlbar', width: baseW, height: Math.max(440, Math.round(baseH * 0.65)) },
    // floor 440px: sotto questa altezza il contenuto delle sezioni full-page
    // (form contatto, 3 step, ranking + sponsor) ha un minimo fisico e non può
    // più comprimersi in modo fluido senza diventare inutilizzabile.
    { name: 'short', width: baseW, height: Math.max(440, Math.round(baseH * 0.5)) },
    { name: 'narrow', width: 320, height: Math.round(baseH * 0.8) },
  ];
  if (baseW > baseH) {
    cases.push({ name: 'landscape-short', width: baseW, height: Math.max(440, Math.round(baseH * 0.6)) });
  } else {
    cases.push({ name: 'landscape', width: baseH, height: Math.max(440, Math.round(baseW * 0.7)) });
  }
  return cases;
}

test.describe('Homepage iOS Viewport/Chrome Stress Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);

  test('stress homepage at reduced/edge viewports', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    test.skip(!IOS_PROJECTS.includes(projectName) || process.env.VISUAL_IOS_MODAL !== '1');

    const base = (await page.viewportSize()) ?? { width: 390, height: 844 };
    const cases = buildStressCases(base.width, base.height);

    setNavigationFailFast(page);
    await seedConsentCookie(page);

    const allFailures: string[] = [];
    const allCases: unknown[] = [];

    for (const stress of cases) {
      await page.setViewportSize({ width: stress.width, height: stress.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');
      await page.addStyleTag({ content: 'html, main { scroll-behavior: auto !important; }' });
      await page.waitForTimeout(300);

      const dir = join(SCREENSHOT_DIR, projectName, `${stress.width}x${stress.height}`);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, 'fullpage.png'), fullPage: true });

      // structural-only: niente report decisionale per sezione né screenshot
      // per sezione → tempo ridotto; gli screenshot per sezione restano negli
      // audit safe-area / homepage.
      const { sections, issueCount } = await auditAllSections(page, {
        vpHeight: stress.height,
        detailed: false,
      });

      const failures: string[] = [];
      for (const s of sections) {
        for (const issue of s.structuralIssues) {
          failures.push(`[${stress.name} ${stress.width}x${stress.height}][section-${s.index}] ${issue.message}: ${issue.detail ?? ''}`);
        }
      }
      allFailures.push(...failures);
      allCases.push({ name: stress.name, width: stress.width, height: stress.height, issueCount, failures });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      spec: 'visual-audit-homepage-ios-chrome.spec.ts',
      mode: 'chrome-stress',
      device: projectName,
      baseViewport: base,
      cases: allCases,
      totalFailures: allFailures.length,
    };
    mkdirSync(REPORT_ROOT, { recursive: true });
    writeFileSync(
      join(REPORT_ROOT, `report-${projectName}.json`),
      JSON.stringify(report, null, 2)
    );

    expect(allFailures, allFailures.join('\n')).toEqual([]);
  });
});
