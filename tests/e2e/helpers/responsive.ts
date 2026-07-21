import { type Page, expect } from '@playwright/test';

export async function checkNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  expect(result.scrollWidth,
    `Horizontal overflow: body scrollWidth (${result.scrollWidth}) > clientWidth (${result.clientWidth})`
  ).toBeLessThanOrEqual(result.clientWidth + 1);
}

export async function checkNoTextClipping(page: Page, containerSelector: string) {
  const clipped = await page.locator(containerSelector).evaluate(el => {
    const elements = Array.from(el.querySelectorAll<HTMLElement>(
      'p, span, h1, h2, h3, h4, button, a, label, li, td, th'
    ));
    return elements
      .filter(child => {
        const cr = child.getBoundingClientRect();
        const pr = child.parentElement?.getBoundingClientRect();
        if (!pr) return false;
        return cr.width > 0 && cr.height > 0 && cr.right > pr.right + 2;
      })
      .slice(0, 10)
      .map(child => ({
        tag: child.tagName,
        text: (child.textContent ?? '').trim().slice(0, 60),
        clipRight: Math.round((child.getBoundingClientRect().right - (child.parentElement?.getBoundingClientRect().right ?? 0))),
      }));
  });
  expect(clipped,
    `Text clipped by parent boundary:\n${clipped.map(c => `  <${c.tag}> "${c.text}" (overflows by ${c.clipRight}px)`).join('\n')}`
  ).toHaveLength(0);
}

export async function checkInteractiveElementsReachable(page: Page) {
  const hidden = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>(
      'button, a[href], input, [role="button"], [tabindex]:not([tabindex="-1"])'
    ));
    return btns
      .map(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isHidden = (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        );
        return { el, isHidden, reason: isHidden ? (
          style.display === 'none' ? 'display:none'
          : style.visibility === 'hidden' ? 'visibility:hidden'
          : parseFloat(style.opacity) === 0 ? 'opacity:0'
          : 'zero dimensions'
        ) : '' };
      })
      .filter(item => item.isHidden && item.el.offsetParent !== null)
      .slice(0, 10)
      .map(item => ({
        tag: item.el.tagName,
        text: (item.el.textContent ?? '').trim().slice(0, 50),
        reason: item.reason,
      }));
  });
  expect(hidden,
    `Unreachable interactive elements:\n${hidden.map(h => `  <${h.tag}> "${h.text}" (${h.reason})`).join('\n')}`
  ).toHaveLength(0);
}
