import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { VIEWPORTS, type ViewportName } from './helpers/viewports';
import { setupAdminForTest, hasAdminMfaCredentials } from './helpers/auth';
import { seedConsentCookie } from './helpers/cookie-consent';
import { setNavigationFailFast } from './helpers/navigation';
import { collectSectionReport, type RouteReport, type SectionReport } from './helpers/layout-analysis';

const GATE_PROJECTS = ['chromium'];

test.beforeEach(async ({}, testInfo) => {
  test.skip(!GATE_PROJECTS.includes(testInfo.project.name));
});

const SCREENSHOT_DIR = 'tests/e2e/visual-audit/screenshots';
const REPORT_PATH = 'tests/e2e/visual-audit/report.json';

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
    name: 'homepage',
    path: '/',
    sections: [
      { name: 'hero', selector: 'main > section:nth-child(1)' },
      { name: 'intro', selector: 'main > section:nth-child(2)' },
      { name: 'how-it-works', selector: 'main > section:nth-child(3)' },
      { name: 'play-again', selector: 'main > section:nth-child(4)' },
      { name: 'prize-location', selector: 'main > section:nth-child(5)' },
      { name: 'search', selector: 'main > section:nth-child(6)' },
      { name: 'public-ranking', selector: 'main > section:nth-child(7)' },
      { name: 'live-ranking', selector: 'main > section:nth-child(8)' },
      { name: 'contact', selector: 'main > section:nth-child(9)' },
    ],
  },
  {
    name: 'coming-soon',
    path: '/coming-soon',
    sections: [
      { name: 'hero', selector: 'main' },
    ],
  },
  {
    name: 'admin-login',
    path: '/admin/login',
    sections: [
      { name: 'login-card', selector: 'main' },
    ],
  },
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

function sanitizeRoute(route: string): string {
  return route === '/' ? 'homepage' : route.replace(/\//g, '-').replace(/^-/, '');
}

function screenshotPath(route: string, viewport: string, filename: string): string {
  return join(SCREENSHOT_DIR, route, viewport, filename);
}

test.describe('Visual Quality Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);
  const allReports: RouteReport[] = [];

  for (const vpName of AUDIT_VIEWPORTS) {
    const vp = VIEWPORTS[vpName];
    test.describe(`${vpName} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES) {
        test(`audit ${route.name}`, async ({ page }) => {
          test.skip(Boolean(route.setup) && !hasAdminMfaCredentials(),
            'E2E admin MFA credentials not configured');
          const routeName = sanitizeRoute(route.name);

          setNavigationFailFast(page);
          await seedConsentCookie(page);

          const report: RouteReport = {
            route: route.path,
            viewportName: vpName,
            viewportWidth: vp.width,
            viewportHeight: vp.height,
            sections: [],
          };

          if (route.setup) {
            await route.setup(page);
          } else {
            await page.goto(route.path);
          }
          await page.waitForLoadState('networkidle');

          const viewportPath = screenshotPath(routeName, vpName, 'viewport.png');
          mkdirSync(dirname(viewportPath), { recursive: true });
          await page.screenshot({ path: viewportPath });

          for (const section of route.sections) {
            const el = page.locator(section.selector);
            const exists = await el.count().then(n => n > 0);

            let sectionReport: SectionReport;
            if (exists) {
              try {
                await el.first().scrollIntoViewIfNeeded();
                await page.waitForTimeout(200);
              } catch {
                // scroll may fail for already-visible elements
              }

              sectionReport = await collectSectionReport(page, section.name, section.selector);

              if (sectionReport.box && sectionReport.box.width > 0 && sectionReport.box.height > 0) {
                const secPath = screenshotPath(routeName, vpName, `${section.name}.png`);
                mkdirSync(dirname(secPath), { recursive: true });
                try {
                  await el.first().screenshot({ path: secPath });
                } catch {
                  // section screenshot may fail, skip
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
            }

            report.sections.push(sectionReport);
          }

          allReports.push(report);
        });
      }
    });
  }

  test.afterAll(() => {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), routes: allReports }, null, 2));
  });
});
