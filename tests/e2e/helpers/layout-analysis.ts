import { type Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutMetrics {
  width: number;
  height: number;
  offsetTop: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  childCount: number;
}

export interface TypographyItem {
  tag: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  textLength: number;
  text: string;
  lines: number;
}

export interface ResponsiveIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  detail?: string;
}

export interface SectionReport {
  name: string;
  selector: string;
  box: Box | null;
  metrics: LayoutMetrics | null;
  typography: TypographyItem[];
  issues: ResponsiveIssue[];
}

export interface RouteReport {
  route: string;
  viewportName: string;
  viewportWidth: number;
  viewportHeight: number;
  sections: SectionReport[];
}

export function getSectionBox(page: Page, selector: string): Promise<Box | null> {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }).catch(() => null);
}

export function extractMetrics(page: Page, selector: string): Promise<LayoutMetrics | null> {
  return page.locator(selector).evaluate((el) => {
    const style = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    const parentOffset = el.parentElement?.getBoundingClientRect().top ?? 0;
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      offsetTop: Math.round(r.top - parentOffset),
      paddingTop: parseInt(style.paddingTop) || 0,
      paddingBottom: parseInt(style.paddingBottom) || 0,
      paddingLeft: parseInt(style.paddingLeft) || 0,
      paddingRight: parseInt(style.paddingRight) || 0,
      childCount: el.children.length,
    };
  }).catch(() => null);
}

export function extractTypography(page: Page, selector: string): Promise<TypographyItem[]> {
  return page.locator(selector).evaluate((el) => {
    const elements = Array.from(el.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, button, a, label, span.font-bold, span.font-black'
    ));
    const seen = new Set<string>();
    return elements
      .filter((child) => {
        const text = (child.textContent ?? '').trim();
        if (!text || seen.has(text)) return false;
        seen.add(text);
        return true;
      })
      .slice(0, 15)
      .map((child) => {
        const style = window.getComputedStyle(child);
        const text = (child.textContent ?? '').trim();
        const lineHeight = parseFloat(style.lineHeight);
        const fontSize = parseFloat(style.fontSize);
        const estimatedLines = fontSize > 0 ? Math.round((child.getBoundingClientRect().height || fontSize) / lineHeight) : 1;
        return {
          tag: child.tagName.toLowerCase(),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontWeight: style.fontWeight,
          textLength: text.length,
          text: text.slice(0, 80),
          lines: Math.max(1, estimatedLines),
        };
      });
  }).catch(() => []);
}

export function checkOverflow(page: Page, selector: string): Promise<ResponsiveIssue[]> {
  return page.locator(selector).evaluate((container) => {
    const issues: ResponsiveIssue[] = [];
    const cr = container.getBoundingClientRect();
    if (cr.width === 0) return issues;

    const children = Array.from(container.querySelectorAll<HTMLElement>(
      'p, span, h1, h2, h3, button, a, label, li, td, th, div:not([hidden])'
    ));
    let maxRight = 0;
    for (const child of children) {
      const r = child.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        if (r.right > cr.right + 2) {
          const text = (child.textContent ?? '').trim().slice(0, 60);
          issues.push({
            severity: 'warning',
            message: 'Element exceeds container right boundary',
            element: `<${child.tagName.toLowerCase()}> "${text}"`,
            detail: `overflows by ${Math.round(r.right - cr.right)}px`,
          });
        }
        if (r.bottom > cr.bottom + 2 && (child.tagName !== 'DIV' || child.children.length === 0)) {
          const text = (child.textContent ?? '').trim().slice(0, 60);
          issues.push({
            severity: 'warning',
            message: 'Element exceeds container bottom boundary',
            element: `<${child.tagName.toLowerCase()}> "${text}"`,
            detail: `overflows by ${Math.round(r.bottom - cr.bottom)}px`,
          });
        }
        maxRight = Math.max(maxRight, r.right);
      }
    }
    return issues;
  }).catch(() => []);
}

export function checkSpacing(page: Page, selector: string): Promise<ResponsiveIssue[]> {
  return page.locator(selector).evaluate((container) => {
    const issues: ResponsiveIssue[] = [];
    const containerStyle = window.getComputedStyle(container);
    const totalHeight = container.getBoundingClientRect().height;
    const contentHeight = Math.max(1, Array.from(container.children).reduce((sum, child) => {
      return sum + child.getBoundingClientRect().height;
    }, 0));
    const paddingTop = parseInt(containerStyle.paddingTop) || 0;
    const paddingBottom = parseInt(containerStyle.paddingBottom) || 0;

    if (contentHeight > 0 && totalHeight > 0) {
      const emptyRatio = 1 - (contentHeight / totalHeight);
      if (emptyRatio > 0.7 && totalHeight > 200) {
        issues.push({
          severity: 'info',
          message: 'Section appears mostly empty',
          detail: `content fills only ${Math.round((1 - emptyRatio) * 100)}% of section height`,
        });
      }
    }
    if (paddingTop > 100) {
      issues.push({
        severity: 'info',
        message: 'Large top padding',
        detail: `${paddingTop}px`,
      });
    }
    if (paddingBottom > 100) {
      issues.push({
        severity: 'info',
        message: 'Large bottom padding',
        detail: `${paddingBottom}px`,
      });
    }
    return issues;
  }).catch(() => []);
}

export function checkTouchTargets(page: Page, selector: string): Promise<ResponsiveIssue[]> {
  return page.locator(selector).evaluate((container) => {
    const issues: ResponsiveIssue[] = [];
    const buttons = Array.from(container.querySelectorAll<HTMLElement>(
      'button, a[href], input, [role="button"]'
    ));
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width > 0 && r.width < 36) {
        issues.push({
          severity: 'warning',
          message: 'Touch target too narrow',
          element: `<${btn.tagName.toLowerCase()}> "${(btn.textContent ?? '').trim().slice(0, 40)}"`,
          detail: `width ${Math.round(r.width)}px (minimum 36px)`,
        });
      }
      if (r.height > 0 && r.height < 36) {
        issues.push({
          severity: 'warning',
          message: 'Touch target too short',
          element: `<${btn.tagName.toLowerCase()}> "${(btn.textContent ?? '').trim().slice(0, 40)}"`,
          detail: `height ${Math.round(r.height)}px (minimum 36px)`,
        });
      }
    }
    return issues;
  }).catch(() => []);
}

export function checkWrapping(page: Page, selector: string): Promise<ResponsiveIssue[]> {
  return page.locator(selector).evaluate((container) => {
    const issues: ResponsiveIssue[] = [];
    const cr = container.getBoundingClientRect();
    if (cr.width === 0) return issues;

    const headings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'));
    for (const h of headings) {
      const r = h.getBoundingClientRect();
      const text = (h.textContent ?? '').trim();
      if (r.width > 0 && r.width < cr.width * 0.3 && text.length > 20) {
        issues.push({
          severity: 'info',
          message: 'Heading narrower than container — possible wrapping issue',
          element: `<${h.tagName.toLowerCase()}> "${text.slice(0, 50)}"`,
          detail: `heading width ${Math.round(r.width)}px vs container ${Math.round(cr.width)}px`,
        });
      }
    }

    const paragraphs = Array.from(container.querySelectorAll<HTMLElement>('p'));
    for (const p of paragraphs) {
      const r = p.getBoundingClientRect();
      const text = (p.textContent ?? '').trim();
      if (r.width > 0 && r.width < cr.width * 0.4 && text.length > 30) {
        issues.push({
          severity: 'info',
          message: 'Paragraph narrower than expected',
          element: `<p> "${text.slice(0, 50)}"`,
          detail: `paragraph ${Math.round(r.width)}px vs container ${Math.round(cr.width)}px`,
        });
      }
    }
    return issues;
  }).catch(() => []);
}

export function collectSectionReport(page: Page, name: string, selector: string): Promise<SectionReport> {
  return Promise.all([
    getSectionBox(page, selector),
    extractMetrics(page, selector),
    extractTypography(page, selector),
    checkOverflow(page, selector),
    checkSpacing(page, selector),
    checkTouchTargets(page, selector),
    checkWrapping(page, selector),
  ]).then(([box, metrics, typography, overflow, spacing, touch, wrapping]) => ({
    name,
    selector,
    box,
    metrics,
    typography,
    issues: [...overflow, ...spacing, ...touch, ...wrapping],
  }));
}

export function getViewport(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
}
