import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';

export interface AllowedViolation {
  id: string;
  reason: string;
}

export async function checkAccessibility(page: Page, options?: {
  disableRules?: { id: string; reason: string }[];
  allowedViolations?: AllowedViolation[];
}) {
  const axe = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.disableRules?.length) {
    axe.disableRules(options.disableRules.map(r => r.id));
  }

  const results = await axe.analyze();

  if (options?.allowedViolations?.length) {
    const allowedIds = options.allowedViolations.map(v => v.id);
    const unexpected = results.violations.filter(v => !allowedIds.includes(v.id));
    expect(unexpected,
      `New accessibility violations (allowed: ${options.allowedViolations.map(v => `${v.id} (${v.reason})`).join(', ')}):\n${
        formatViolations(unexpected)}`
    ).toHaveLength(0);
  } else {
    expect(results.violations,
      `Accessibility violations:\n${formatViolations(results.violations)}`
    ).toHaveLength(0);
  }

  return results;
}

function formatViolations(violations: { id: string; impact?: string | null; help?: string; nodes: { html: string }[] }[]) {
  return violations.map(v =>
    `  - ${v.id}: ${v.impact ?? 'N/A'} — ${v.help ?? v.id}\n` +
    v.nodes.slice(0, 3).map(n => `      ${n.html}`).join('\n')
  ).join('\n');
}
