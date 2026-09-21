import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { VIEWPORTS, type ViewportName } from './helpers/viewports';
import { setupAdminForTest, hasAdminMfaCredentials } from './helpers/auth';
import { collectSectionReport, type RouteReport, type SectionReport } from './helpers/layout-analysis';
import { setNavigationFailFast } from './helpers/navigation';

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

const SCREENSHOT_DIR = 'tests/e2e/visual-audit/screenshots';
const REPORT_PATH = 'tests/e2e/visual-audit/report-admin.json';

const AUDIT_VIEWPORTS: ViewportName[] = ['mobile', 'tablet-portrait', 'desktop'];

interface SectionDef {
  name: string;
  selector: string;
}

interface RouteDef {
  name: string;
  path: string;
  sections: SectionDef[];
  setup?: (page: import('@playwright/test').Page) => Promise<void>;
}

const ROUTES: RouteDef[] = [
  {
    name: 'admin-dashboard-panoramica',
    path: '/admin/dashboard/panoramica',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/panoramica'),
    sections: [
      { name: 'page-header', selector: 'header' },
      { name: 'stat-cards', selector: 'main .grid.grid-cols-2' },
      { name: 'chart-area', selector: 'main .recharts-responsive-container' },
    ],
  },
  {
    name: 'admin-dashboard-aziende',
    path: '/admin/dashboard/aziende',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/aziende'),
    sections: [
      { name: 'page-header', selector: 'header' },
      { name: 'card-content', selector: '[data-slot="card-content"]' },
    ],
  },
  {
    name: 'admin-dashboard-voti',
    path: '/admin/dashboard/voti',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/voti'),
    sections: [
      { name: 'page-header', selector: 'header' },
      { name: 'search-input', selector: 'input[placeholder*="Cerca"]' },
      { name: 'vote-content', selector: '[data-slot="card-content"]' },
    ],
  },
  {
    name: 'admin-dashboard-impostazioni',
    path: '/admin/dashboard/impostazioni',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/impostazioni'),
    sections: [
      { name: 'page-header', selector: 'header' },
      { name: 'coming-soon-toggle', selector: '[data-slot="card"]:first-of-type' },
    ],
  },
  {
    name: 'admin-dashboard-sponsor',
    path: '/admin/dashboard/sponsor',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/sponsor'),
    sections: [
      { name: 'page-header', selector: 'header' },
      { name: 'sponsor-list', selector: 'main [data-slot="card-content"]' },
    ],
  },
  {
    name: 'admin-dashboard-import',
    path: '/admin/dashboard/import',
    setup: (page: import('@playwright/test').Page) => setupAdminForTest(page, '/admin/dashboard/import'),
    sections: [
      { name: 'page-header', selector: 'main h1' },
      { name: 'upload-area', selector: '[class*="border-dashed"]' },
    ],
  },
];

function screenshotPath(route: string, viewport: string, filename: string): string {
  return join(SCREENSHOT_DIR, route, viewport, filename);
}

test.describe('Admin Visual Quality Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);
  const allReports: RouteReport[] = [];

  test.afterAll(() => {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), routes: allReports }, null, 2));
  });

  for (const vpName of AUDIT_VIEWPORTS) {
    const vp = VIEWPORTS[vpName];
    test.describe(`${vpName} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES) {
        test(`audit ${route.name}`, async ({ page }) => {
          test.skip(Boolean(route.setup) && !hasAdminMfaCredentials(),
            'E2E admin MFA credentials not configured');
          setNavigationFailFast(page);
          const report: RouteReport = {
            route: route.path,
            viewportName: vpName,
            viewportWidth: vp.width,
            viewportHeight: vp.height,
            sections: [],
          };

          await route.setup!(page);
          await page.waitForLoadState('networkidle');

          const viewportPath = screenshotPath(route.name, vpName, 'viewport.png');
          mkdirSync(dirname(viewportPath), { recursive: true });
          await page.screenshot({ path: viewportPath });

          const nav = page.locator('[data-testid="admin-bottom-nav"]');
          if (await nav.count().then(n => n > 0)) {
            const navPath = screenshotPath(route.name, vpName, 'bottom-nav.png');
            mkdirSync(dirname(navPath), { recursive: true });
            try {
              await nav.first().screenshot({ path: navPath, timeout: 5000 });
            } catch {}
          }

          for (const section of route.sections) {
            const el = page.locator(section.selector);
            const exists = await el.count().then(n => n > 0);

            let sectionReport: SectionReport;
            if (exists) {
              try {
                await el.first().scrollIntoViewIfNeeded();
                await page.waitForTimeout(200);
              } catch {}

              sectionReport = await collectSectionReport(page, section.name, section.selector);

              if (sectionReport.box && sectionReport.box.width > 0 && sectionReport.box.height > 0) {
                const secPath = screenshotPath(route.name, vpName, `${section.name}.png`);
                mkdirSync(dirname(secPath), { recursive: true });
                try {
                  await el.first().screenshot({ path: secPath });
                } catch {}
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
            }

            report.sections.push(sectionReport);
          }

          allReports.push(report);
        });
      }
    });
  }
});
