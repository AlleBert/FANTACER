import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { seedConsentCookie } from './helpers/cookie-consent';
import { setNavigationFailFast } from './helpers/navigation';
import {
  collectSectionReport,
  collectSubElementReport,
  type RouteReport,
  type SectionReport,
  type SubElementReport,
} from './helpers/layout-analysis';

const SCREENSHOT_DIR = 'tests/e2e/visual-audit-homepage-ios/screenshots';
const REPORT_DIR = 'tests/e2e/visual-audit-homepage-ios';

const SECTIONS = [
  { name: 'hero', selector: 'main > section:nth-child(1)' },
  { name: 'intro', selector: 'main > section:nth-child(2)' },
  { name: 'how-it-works', selector: 'main > section:nth-child(3)' },
  { name: 'play-again', selector: 'main > section:nth-child(4)' },
  { name: 'prize-location', selector: 'main > section:nth-child(5)' },
  { name: 'search', selector: 'main > section:nth-child(6)' },
  { name: 'public-ranking', selector: 'main > section:nth-child(7)' },
  { name: 'live-ranking', selector: 'main > section:nth-child(8)' },
  { name: 'contact', selector: 'main > section:nth-child(9)' },
];

interface IOSRouteReport extends RouteReport {
  device: string;
  userAgent: string;
  subElementReports: SubElementReport[];
  fullPageScreenshot: string;
  issueCount: number;
}

test.describe('Homepage iOS Visual Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('audit homepage on iOS device', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;

    setNavigationFailFast(page);
    await seedConsentCookie(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await Promise.all([
      page.waitForResponse('/api/public/sponsors', { timeout: 20000 }),
      page.waitForResponse('/api/public/ranking', { timeout: 20000 }),
    ]);
    await page.waitForTimeout(300);

    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    const ua = await page.evaluate(() => navigator.userAgent);

    const report: IOSRouteReport = {
      route: '/',
      viewportName: projectName,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      device: projectName,
      userAgent: ua,
      sections: [],
      subElementReports: [],
      fullPageScreenshot: '',
      issueCount: 0,
    };

    const fpPath = join(SCREENSHOT_DIR, projectName, 'fullpage.png');
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
          const secPath = join(SCREENSHOT_DIR, projectName, `${section.name}.png`);
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

    let issueCount = 0;
    for (const s of report.sections) {
      issueCount += s.issues.length;
    }
    for (const sr of report.subElementReports) {
      issueCount += sr.issues.length;
    }
    report.issueCount = issueCount;

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      join(REPORT_DIR, `report-${projectName}.json`),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          spec: '2026-07-22-homepage-responsive-audit-spec.md',
          device: projectName,
          viewport: { width: viewportSize.width, height: viewportSize.height },
          userAgent: ua.slice(0, 120),
          sections: report.sections.length,
          issueCount: report.issueCount,
          routes: [report],
        },
        null,
        2
      )
    );
  });
});
