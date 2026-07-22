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

// ─── Sub-element analysis types ───────────────────────────────────────────────

export interface SubElementInteractive {
  tag: string;
  text: string;
  box: Box | null;
  visible: boolean;
  touchWidth: number;
  touchHeight: number;
}

export interface SubElementImage {
  tag: string;
  src: string;
  alt: string;
  renderedBox: Box | null;
  naturalWidth: number;
  naturalHeight: number;
  objectFit: string;
  loading: string;
  distortion: number | null;
}

export interface SubElementHeading {
  tag: string;
  text: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  box: Box | null;
}

export interface SubElementTextBlock {
  text: string;
  width: number;
  containerWidth: number;
  fontSize: number;
  lineHeight: number;
  ratio: number;
}

export interface SubElementLayoutIssue {
  type: string;
  tag: string;
  position: string;
  box: Box | null;
  overflowHidden: boolean;
}

export interface SubElementReport {
  interactive: SubElementInteractive[];
  images: SubElementImage[];
  headings: SubElementHeading[];
  textBlocks: SubElementTextBlock[];
  layoutAnomalies: SubElementLayoutIssue[];
  issues: ResponsiveIssue[];
}

// ─── Sub-element collection helpers ───────────────────────────────────────────

export function collectInteractiveElements(page: Page, selector: string): Promise<SubElementInteractive[]> {
  return page.locator(selector).evaluate((container) => {
    const items = Array.from(container.querySelectorAll<HTMLElement>('button, a[href], input, [role="button"]'));
    return items.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 60),
        box: r.width > 0 ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null,
        visible: r.width > 0 && r.height > 0,
        touchWidth: Math.round(r.width),
        touchHeight: Math.round(r.height),
      };
    });
  }).catch(() => []);
}

export function collectImages(page: Page, selector: string): Promise<SubElementImage[]> {
  return page.locator(selector).evaluate((container) => {
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    return imgs.map((img) => {
      const r = img.getBoundingClientRect();
      const natW = img.naturalWidth || 0;
      const natH = img.naturalHeight || 0;
      let distortion: number | null = null;
      if (natW > 0 && natH > 0 && r.width > 0 && r.height > 0) {
        const natRatio = natW / natH;
        const renderedRatio = r.width / r.height;
        distortion = Math.abs(renderedRatio - natRatio);
      }
      return {
        tag: 'img',
        src: img.src?.slice(0, 100) || '',
        alt: img.alt || '',
        renderedBox: r.width > 0 ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null,
        naturalWidth: natW,
        naturalHeight: natH,
        objectFit: window.getComputedStyle(img).objectFit,
        loading: img.loading,
        distortion,
      };
    });
  }).catch(() => []);
}

export function collectHeadings(page: Page, selector: string): Promise<SubElementHeading[]> {
  return page.locator(selector).evaluate((container) => {
    const headings = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4'));
    return headings.map((h) => {
      const r = h.getBoundingClientRect();
      const style = window.getComputedStyle(h);
      return {
        tag: h.tagName.toLowerCase(),
        text: (h.textContent ?? '').trim().slice(0, 80),
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        box: r.width > 0 ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null,
      };
    });
  }).catch(() => []);
}

export function collectTextBlocks(page: Page, selector: string): Promise<SubElementTextBlock[]> {
  return page.locator(selector).evaluate((container) => {
    const paras = Array.from(container.querySelectorAll<HTMLElement>('p'));
    const cr = container.getBoundingClientRect();
    return paras
      .map((p) => {
        const text = (p.textContent ?? '').trim();
        if (text.length <= 30) return null;
        const r = p.getBoundingClientRect();
        const style = window.getComputedStyle(p);
        const fontSize = parseFloat(style.fontSize) || 16;
        const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.4;
        return {
          text: text.slice(0, 80),
          width: Math.round(r.width),
          containerWidth: Math.round(cr.width),
          fontSize,
          lineHeight,
          ratio: cr.width > 0 ? r.width / cr.width : 1,
        };
      })
      .filter((p): p is SubElementTextBlock => p !== null);
  }).catch(() => []);
}

export function collectLayoutAnomalies(page: Page, selector: string): Promise<SubElementLayoutIssue[]> {
  return page.locator(selector).evaluate((container) => {
    const items: SubElementLayoutIssue[] = [];
    const all = Array.from(container.querySelectorAll<HTMLElement>('*'));
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const pos = style.position;
      if (pos === 'absolute' || pos === 'fixed') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          items.push({
            type: 'positioned',
            tag: el.tagName.toLowerCase(),
            position: pos,
            box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
            overflowHidden: style.overflow === 'hidden',
          });
        }
      }
    }
    return items;
  }).catch(() => []);
}

export function collectSubElementReport(page: Page, name: string, selector: string): Promise<SubElementReport> {
  return Promise.all([
    collectInteractiveElements(page, selector),
    collectImages(page, selector),
    collectHeadings(page, selector),
    collectTextBlocks(page, selector),
    collectLayoutAnomalies(page, selector),
  ]).then(([interactive, images, headings, textBlocks, layoutAnomalies]) => {
    const issues: ResponsiveIssue[] = [];

    for (const el of interactive) {
      if (el.visible && el.touchWidth > 0 && el.touchWidth < 36) {
        issues.push({
          severity: 'warning',
          message: `Touch target too narrow: <${el.tag}> "${el.text}"`,
          element: `<${el.tag}>`,
          detail: `width ${el.touchWidth}px (minimum 36px)`,
        });
      }
      if (el.visible && el.touchHeight > 0 && el.touchHeight < 36) {
        issues.push({
          severity: 'warning',
          message: `Touch target too short: <${el.tag}> "${el.text}"`,
          element: `<${el.tag}>`,
          detail: `height ${el.touchHeight}px (minimum 36px)`,
        });
      }
    }

    for (const img of images) {
      if (img.distortion !== null && img.distortion > 0.05) {
        issues.push({
          severity: 'warning',
          message: `Image aspect ratio distorted: ${img.alt ? `"${img.alt}"` : img.src.slice(0, 40)}`,
          element: '<img>',
          detail: `distortion ${img.distortion.toFixed(3)} (threshold 0.05)`,
        });
      }
      if (!img.alt && img.src) {
        issues.push({
          severity: 'info',
          message: `Image missing alt text: ${img.src.slice(0, 40)}`,
          element: '<img>',
        });
      }
    }

    for (const tb of textBlocks) {
      if (tb.ratio < 0.4) {
        issues.push({
          severity: 'info',
          message: `Text narrower than container: "${tb.text}"`,
          element: '<p>',
          detail: `${Math.round(tb.ratio * 100)}% of container width`,
        });
      }
    }

    for (const la of layoutAnomalies) {
      if (la.position === 'fixed' || la.position === 'absolute') {
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        if (la.box && (la.box.x + la.box.width > vpW + 2 || la.box.y + la.box.height > vpH + 2)) {
          issues.push({
            severity: 'warning',
            message: `Positioned element overflows viewport: <${la.tag}>`,
            element: `<${la.tag}>`,
            detail: `${la.position} at (${la.box.x},${la.box.y}) size ${la.box.width}x${la.box.height}`,
          });
        }
      }
    }

    return { interactive, images, headings, textBlocks, layoutAnomalies, issues };
  });
}
