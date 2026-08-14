import { type Page } from '@playwright/test';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import {
  collectSectionReport,
  collectSubElementReport,
  checkSectionMicroScroll,
  checkSectionHeightVsViewport,
  checkSectionWithinViewport,
  getSectionBox,
  type SectionReport,
  type SubElementReport,
  type ResponsiveIssue,
} from './layout-analysis';

export interface SectionAudit {
  index: number;
  section: SectionReport;
  sub: SubElementReport;
  structuralIssues: ResponsiveIssue[];
}

export interface SectionAuditOptions {
  vpHeight: number;
  screenshotDir?: string;
  /**
   * `true` (default): report decisionale completo (layout, typography, touch,
   * immagini, anomalie) + screenshot per sezione. `false`: solo i check
   * strutturali P0 (micro-scroll/overflow/altezza/within-viewport), senza
   * report per sezione né screenshot → molto più veloce.
   */
  detailed?: boolean;
}

const EMPTY_SUB_REPORT: SubElementReport = {
  interactive: [],
  images: [],
  headings: [],
  textBlocks: [],
  layoutAnomalies: [],
  issues: [],
};

/**
 * Colleziona per ogni sezione full-page (`main > section`) il report di layout,
 * i sub-elementi e i check strutturali P0 (micro-scroll / overflow / altezza vs
 * viewport / box nel viewport), con screenshot opzionali per sezione.
 * Con `detailed: false` esegue solo i check strutturali.
 */
export async function auditAllSections(
  page: Page,
  options: SectionAuditOptions
): Promise<{ sections: SectionAudit[]; issueCount: number }> {
  const count = await page.locator('main > section').count();
  const sections: SectionAudit[] = [];
  let issueCount = 0;

  for (let i = 0; i < count; i++) {
    const selector = `main > section:nth-child(${i + 1})`;
    const el = page.locator(selector).first();
    const exists = await el.count().then((n) => n > 0);
    if (!exists) continue;

    try {
      await el.scrollIntoViewIfNeeded();
    } catch {
      // sezione non scrollabile: procedi comunque
    }
    await page.waitForTimeout(80);

    const name = `section-${i + 1}`;

    if (options.detailed === false) {
      const [box, micro, height, within] = await Promise.all([
        getSectionBox(page, selector),
        checkSectionMicroScroll(page, selector),
        checkSectionHeightVsViewport(page, selector, options.vpHeight),
        checkSectionWithinViewport(page, selector),
      ]);
      const structuralIssues = [...micro, ...height, ...within];
      const section: SectionReport = {
        name,
        selector,
        box,
        metrics: null,
        typography: [],
        issues: [],
      };
      sections.push({ index: i + 1, section, sub: EMPTY_SUB_REPORT, structuralIssues });
      issueCount += structuralIssues.length;
      continue;
    }

    const [section, sub, micro, height, within] = await Promise.all([
      collectSectionReport(page, name, selector),
      collectSubElementReport(page, name, selector),
      checkSectionMicroScroll(page, selector),
      checkSectionHeightVsViewport(page, selector, options.vpHeight),
      checkSectionWithinViewport(page, selector),
    ]);
    const structuralIssues = [...micro, ...height, ...within];

    if (
      options.screenshotDir &&
      section.box &&
      section.box.width > 0 &&
      section.box.height > 0
    ) {
      const file = join(options.screenshotDir, `${name}.png`);
      mkdirSync(dirname(file), { recursive: true });
      try {
        await el.screenshot({ path: file });
      } catch {
        // screenshot opzionale
      }
    }

    sections.push({ index: i + 1, section, sub, structuralIssues });
    issueCount += section.issues.length + sub.issues.length + structuralIssues.length;
  }

  return { sections, issueCount };
}
