import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { VIEWPORTS, type ViewportName } from './helpers/viewports';
import { setNavigationFailFast } from './helpers/navigation';
import {
  checkSectionMicroScroll,
  checkSectionHeightVsViewport,
  checkSectionWithinViewport,
} from './helpers/layout-analysis';

/**
 * Gate strutturale P0 — gira in `test:e2e` su chromium e mobile-webkit.
 * Per ogni sezione della homepage verifica (con assert reali, tolleranza 2px):
 *  - zero micro-scroll / clipping verticale (scrollHeight <= clientHeight + 1);
 *  - zero overflow orizzontale (scrollWidth <= clientWidth + 1);
 *  - altezza sezione <= viewport disponibile;
 *  - bounding box dentro la viewport.
 * Identifica le sezioni con `main > section` (robusto al riordino del DOM).
 * Scrive anche `tests/e2e/responsive-structural/report.json` (consumato dal
 * riepilogo `npm run visual:audit:summary`).
 */
const GATE_PROJECTS = ['chromium', 'mobile-webkit'];

const AUDIT_VIEWPORTS: ViewportName[] = [
  'mobile-small',
  'mobile',
  'tablet-portrait',
  'tablet-landscape',
  'desktop',
  'desktop-wide',
];

const REPORT_PATH = 'tests/e2e/responsive-structural/report.json';

interface SectionRun {
  index: number;
  issues: string[];
}

interface ViewportRun {
  viewport: string;
  width: number;
  height: number;
  project: string;
  pass: boolean;
  sections: SectionRun[];
}

test.describe('Responsive structural gate (P0)', () => {
  // serial: evita l'instabilità WebKit con pagine parallele (connection refused)
  test.describe.configure({ mode: 'serial' });
  const allRuns: ViewportRun[] = [];

  for (const vpName of AUDIT_VIEWPORTS) {
    const vp = VIEWPORTS[vpName];

    test(`no micro-scroll / overflow / out-of-viewport sections at ${vpName} (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
      test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
      test.setTimeout(90000);
      setNavigationFailFast(page);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');
      // scroll-behavior: auto → determinismo nello scroll tra sezioni
      await page.addStyleTag({ content: 'html, main { scroll-behavior: auto !important; }' });
      await page.waitForTimeout(800);

      const sectionCount = await page.locator('main > section').count();
      expect(sectionCount, 'no full-page sections found under main').toBeGreaterThan(0);

      const allIssues: string[] = [];
      const sectionRuns: SectionRun[] = [];
      for (let i = 0; i < sectionCount; i++) {
        const selector = `main > section:nth-child(${i + 1})`;
        const el = page.locator(selector);
        try {
          await el.first().scrollIntoViewIfNeeded();
        } catch {
          // sezione non scrollabile: procedi comunque
        }
        await page.waitForTimeout(120);

        const [micro, height, within] = await Promise.all([
          checkSectionMicroScroll(page, selector),
          checkSectionHeightVsViewport(page, selector, vp.height),
          checkSectionWithinViewport(page, selector),
        ]);

        const sectionIssues = [...micro, ...height, ...within];
        sectionRuns.push({
          index: i + 1,
          issues: sectionIssues.map((issue) => `${issue.message}: ${issue.detail ?? ''}`),
        });
        for (const issue of sectionIssues) {
          allIssues.push(`[section #${i + 1}] ${issue.message}: ${issue.detail ?? ''}`);
        }

        const cardHeights = await page.evaluate((sel: string) => {
          const section = document.querySelector(sel);
          if (!section) return [];
          return Array.from(section.querySelectorAll<HTMLElement>('a, div'))
            .filter((el) => el.style.getPropertyValue('--sponsor-size'))
            .map((el) => Math.round(el.getBoundingClientRect().height));
        }, selector);
        for (const h of cardHeights) {
          if (h < 40) allIssues.push(`[section #${i + 1}] sponsor card collassata: altezza ${h}px (< 40px)`);
        }
      }

      allRuns.push({
        viewport: vpName,
        width: vp.width,
        height: vp.height,
        project: testInfo.project.name,
        pass: allIssues.length === 0,
        sections: sectionRuns,
      });

      expect(allIssues, allIssues.join('\n')).toEqual([]);
    });
  }

  test.afterAll(() => {
    const passed = allRuns.filter((r) => r.pass).length;
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          spec: 'responsive-structural.spec.ts',
          projects: GATE_PROJECTS,
          viewports: allRuns,
          totals: { runs: allRuns.length, passed, failed: allRuns.length - passed },
        },
        null,
        2
      )
    );
  });
});
