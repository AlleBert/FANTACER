import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { auditAllSections } from './helpers/section-audit';
import { seedConsentCookie } from './helpers/cookie-consent';
import { setNavigationFailFast } from './helpers/navigation';

/**
 * Audit iOS — modalità safe-area.
 *
 * Playwright/WebKit NON simula `env(safe-area-inset-*)` reali (niente notch /
 * Dynamic Island / home indicator). Questo audit emula l'effetto sul layout
 * overrideando i token CSS di consumo (`--safe-area-inset-*` in :root), che il
 * progetto usa in `--safe-top` / `--safe-bottom` / `--safe-x`.
 *
 * Eseguito solo sui progetti `ios-*` con `VISUAL_IOS_MODAL=1` (vedi script npm).
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

const REPORT_ROOT = 'tests/e2e/visual-audit-homepage-ios/safe-area';
const SCREENSHOT_DIR = join(REPORT_ROOT, 'screenshots');

// Inset simulati tipici dei device Apple reali (in px).
const SAFE_INSETS: Record<string, { top: number; bottom: number; left: number; right: number }> = {
  'ios-se': { top: 20, bottom: 0, left: 0, right: 0 },
  'ios-iphone': { top: 47, bottom: 34, left: 0, right: 0 },
  'ios-pro-max': { top: 59, bottom: 34, left: 0, right: 0 },
  'ios-ipad-portrait': { top: 24, bottom: 20, left: 0, right: 0 },
  'ios-ipad-landscape': { top: 24, bottom: 21, left: 0, right: 0 },
  'ios-ipad-pro-portrait': { top: 24, bottom: 20, left: 0, right: 0 },
  'ios-ipad-pro-landscape': { top: 24, bottom: 21, left: 0, right: 0 },
};

test.describe('Homepage iOS Safe-Area Audit', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240000);

  test('audit homepage with simulated safe areas', async ({ page }, testInfo) => {
    const projectName = testInfo.project.name;
    test.skip(!IOS_PROJECTS.includes(projectName) || process.env.VISUAL_IOS_MODAL !== '1');

    const insets = SAFE_INSETS[projectName] ?? { top: 0, bottom: 0, left: 0, right: 0 };

    setNavigationFailFast(page);
    await seedConsentCookie(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await Promise.all([
      page.waitForResponse('/api/public/sponsors', { timeout: 20000 }),
      page.waitForResponse('/api/public/ranking', { timeout: 20000 }),
    ]);
    await page.waitForTimeout(300);

    // Emula notch / Dynamic Island / home indicator via override dei token CSS.
    await page.addStyleTag({
      content: `:root {
        --safe-area-inset-top: ${insets.top}px !important;
        --safe-area-inset-bottom: ${insets.bottom}px !important;
        --safe-area-inset-left: ${insets.left}px !important;
        --safe-area-inset-right: ${insets.right}px !important;
      }`,
    });
    await page.waitForTimeout(150);

    const vp = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    const dir = join(SCREENSHOT_DIR, projectName);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, 'fullpage.png'), fullPage: true });

    const { sections, issueCount } = await auditAllSections(page, {
      vpHeight: vp.height,
      screenshotDir: dir,
    });

    // Footer legale del ContactSection: non oscurato dall'home indicator simulato.
    let footerIssue = '';
    try {
      const contact = page.locator('#contact-section').first();
      await contact.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
      const footerInfo = await page.locator('#contact-section footer').first().evaluate((f) => {
        const r = f.getBoundingClientRect();
        const inner = f.querySelector('div')?.getBoundingClientRect();
        return {
          innerBottom: inner ? Math.round(inner.bottom) : null,
          footerBottom: Math.round(r.bottom),
          vh: window.innerHeight,
        };
      });
      const contentBottom = footerInfo.innerBottom ?? footerInfo.footerBottom;
      const clearance = footerInfo.vh - contentBottom;
      if (clearance < insets.bottom - 4) {
        footerIssue = `footer legal overlaps home indicator: clearance ${clearance}px < simulated inset ${insets.bottom}px`;
      }
    } catch {
      footerIssue = 'contact section / footer not found';
    }

    const report = {
      generatedAt: new Date().toISOString(),
      spec: 'visual-audit-homepage-ios-safearea.spec.ts',
      mode: 'safe-area',
      device: projectName,
      viewport: { width: vp.width, height: vp.height },
      safeAreaInsets: insets,
      sectionCount: sections.length,
      issueCount,
      footerIssue,
      sections: sections.map((s) => ({
        index: s.index,
        section: s.section,
        structuralIssues: s.structuralIssues,
        subElementIssues: s.sub.issues,
      })),
    };

    mkdirSync(REPORT_ROOT, { recursive: true });
    writeFileSync(
      join(REPORT_ROOT, `report-${projectName}.json`),
      JSON.stringify(report, null, 2)
    );
  });
});
