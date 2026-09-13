import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { VIEWPORTS, type ViewportName } from './helpers/viewports';
import { seedConsentCookie } from './helpers/cookie-consent';
import { setNavigationFailFast } from './helpers/navigation';
import {
  collectSectionReport,
  collectSubElementReport,
  type RouteReport,
  type SectionReport,
  type SubElementReport,
} from './helpers/layout-analysis';

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

const SCREENSHOT_DIR = 'tests/e2e/visual-audit-homepage/screenshots';
const REPORT_PATH = 'tests/e2e/visual-audit-homepage/report.json';

const AUDIT_VIEWPORTS: ViewportName[] = [
  'mobile-small',
  'mobile',
  'tablet-portrait',
  'tablet-landscape',
  'desktop',
  'desktop-wide',
];

interface SectionDef {
  name: string;
  selector: string;
}

const SECTIONS: SectionDef[] = [
  { name: 'hero', selector: 'main > section:nth-child(1)' },
  { name: 'intro', selector: 'main > section:nth-child(2)' },
  { name: 'how-it-works', selector: 'main > section:nth-child(3)' },
  { name: 'play-again', selector: 'main > section:nth-child(4)' },
  { name: 'search', selector: 'main > section:nth-child(5)' },
  { name: 'public-ranking', selector: 'main > section:nth-child(6)' },
  { name: 'live-ranking', selector: 'main > section:nth-child(7)' },
  { name: 'contact', selector: 'main > section:nth-child(8)' },
];

interface HomepageRouteReport extends RouteReport {
  subElementReports: SubElementReport[];
  fullPageScreenshot: string;
}

function screenshotPath(...parts: string[]): string {
  return join(SCREENSHOT_DIR, ...parts);
}

interface ResponsivenessSummary {
  totalElements: number;
  fullyResponsive: number;
  partiallyResponsive: number;
  broken: number;
  score: string;
}

test.describe('Homepage Responsive Visual Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300000);
  const allReports: HomepageRouteReport[] = [];

  for (const vpName of AUDIT_VIEWPORTS) {
    const vp = VIEWPORTS[vpName];
    test.describe(`${vpName} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`audit homepage at ${vpName}`, async ({ page }) => {
        setNavigationFailFast(page);
        await seedConsentCookie(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const report: HomepageRouteReport = {
          route: '/',
          viewportName: vpName,
          viewportWidth: vp.width,
          viewportHeight: vp.height,
          sections: [],
          subElementReports: [],
          fullPageScreenshot: '',
        };

        const fpPath = screenshotPath(vpName, 'fullpage.png');
        mkdirSync(dirname(fpPath), { recursive: true });
        await page.screenshot({ path: fpPath, fullPage: true });
        report.fullPageScreenshot = fpPath;

        for (const section of SECTIONS) {
          const el = page.locator(section.selector);
          const exists = await el.count().then((n) => n > 0);

          let sectionReport: SectionReport;
          let subReport: SubElementReport;

          if (exists) {
            try {
              await el.first().scrollIntoViewIfNeeded();
              await page.waitForTimeout(200);
            } catch {
              // scroll may fail
            }

            sectionReport = await collectSectionReport(page, section.name, section.selector);
            subReport = await collectSubElementReport(page, section.name, section.selector);

            if (sectionReport.box && sectionReport.box.width > 0 && sectionReport.box.height > 0) {
              const secPath = screenshotPath(vpName, `${section.name}.png`);
              mkdirSync(dirname(secPath), { recursive: true });
              try {
                await el.first().screenshot({ path: secPath });
              } catch {
                // section screenshot may fail
              }
            }
          } else {
            sectionReport = {
              name: section.name,
              selector: section.selector,
              box: null,
              metrics: null,
              typography: [],
              issues: [{ severity: 'info', message: 'Section not found on page', element: section.selector }],
            };
            subReport = {
              interactive: [],
              images: [],
              headings: [],
              textBlocks: [],
              layoutAnomalies: [],
              issues: [],
            };
          }

          report.sections.push(sectionReport);
          report.subElementReports.push(subReport);
        }

        allReports.push(report);
      });
    });
  }

  test.afterAll(() => {
    const elementCounts: Map<string, { pass: number; total: number }> = new Map();

    for (const report of allReports) {
      for (let i = 0; i < SECTIONS.length; i++) {
        const sr = report.subElementReports[i];
        if (!sr) continue;

        for (const el of sr.interactive) {
          const key = `${SECTIONS[i].name}:interactive:${el.text}`;
          const entry = elementCounts.get(key) || { pass: 0, total: 0 };
          entry.total++;
          if (el.visible && el.touchWidth >= 36 && el.touchHeight >= 36) entry.pass++;
          elementCounts.set(key, entry);
        }
        for (const el of sr.images) {
          const key = `${SECTIONS[i].name}:img:${el.src.slice(0, 60)}`;
          const entry = elementCounts.get(key) || { pass: 0, total: 0 };
          entry.total++;
          if (el.distortion === null || el.distortion <= 0.05) entry.pass++;
          elementCounts.set(key, entry);
        }
      }
    }

    const totalElements = elementCounts.size;
    let fullyResponsive = 0;
    let partiallyResponsive = 0;
    let broken = 0;
    for (const { pass, total } of Array.from(elementCounts.values())) {
      if (pass === total) fullyResponsive++;
      else if (pass > 0) partiallyResponsive++;
      else broken++;
    }
    const score = totalElements > 0 ? `${Math.round((fullyResponsive / totalElements) * 100)}%` : 'N/A';

    const summary: ResponsivenessSummary = {
      totalElements,
      fullyResponsive,
      partiallyResponsive,
      broken,
      score,
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          spec: '2026-07-22-homepage-responsive-audit-spec.md',
          responsivenessSummary: summary,
          routes: allReports,
        },
        null,
        2
      )
    );
  });
});
