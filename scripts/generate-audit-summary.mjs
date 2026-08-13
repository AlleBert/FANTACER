#!/usr/bin/env node
/**
 * Report riepilogativo degli audit visuali.
 *
 * Legge tutti i report JSON generati dagli audit Playwright e produce un
 * riepilogo unico e dettagliato (suite, viewport/device analizzati, issue per
 * severità, punteggi, gate strutturale). È un post-processing offline: non
 * avvia browser, quindi NON incide sui tempi degli audit.
 *
 * Uso: `npm run visual:audit:summary`
 * Output: tests/e2e/audit-summary/summary.json + summary.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'tests/e2e/audit-summary');

// ─── Utility ────────────────────────────────────────────────────────────────

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function globReports(pattern) {
  const dir = dirname(pattern);
  const base = pattern.split('/').pop();
  const star = base.indexOf('*');
  const prefix = star === -1 ? base : base.slice(0, star);
  if (star === -1) {
    return existsSync(join(ROOT, pattern)) ? [pattern] : [];
  }
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

function severityOf(issue) {
  return issue && typeof issue.severity === 'string' ? issue.severity : 'info';
}

function countIssues(issues) {
  const counts = { errors: 0, warnings: 0, infos: 0 };
  for (const i of issues || []) {
    const s = severityOf(i);
    if (s === 'error') counts.errors++;
    else if (s === 'warning') counts.warnings++;
    else counts.infos++;
  }
  return counts;
}

function addCounts(target, source) {
  target.errors += source.errors || 0;
  target.warnings += source.warnings || 0;
  target.infos += source.infos || 0;
}

function flattenSectionIssues(sections) {
  const issues = [];
  for (const s of sections || []) {
    issues.push(...(s.issues || []));
  }
  return issues;
}

function flattenSubIssues(subReports) {
  const issues = [];
  for (const sr of subReports || []) {
    issues.push(...(sr.issues || []));
  }
  return issues;
}

// ─── Normalizzatori per suite ───────────────────────────────────────────────

/**
 * Report con `routes[]` (RouteReport: route, viewportName, viewportWidth/Height,
 * sections, subElementReports). Usato da visual-audit / visual-audit:admin /
 * visual-audit:homepage / visual-audit:ios.
 */
function normalizeRoutesReport(report, deviceFromReport) {
  const entries = [];
  for (const r of report.routes || []) {
    const issues = [
      ...flattenSectionIssues(r.sections),
      ...flattenSubIssues(r.subElementReports),
    ];
    entries.push({
      viewportName: r.viewportName || 'n/a',
      width: r.viewportWidth || 0,
      height: r.viewportHeight || 0,
      device: deviceFromReport ? report.device : undefined,
      route: r.route,
      sectionCount: (r.sections || []).length,
      issues,
    });
  }
  return entries;
}

/**
 * Report safe-area: sezioni con `section.issues`, `structuralIssues`,
 * `subElementIssues`; `viewport {width,height}`; `footerIssue`.
 */
function normalizeSafeAreaReport(report) {
  const issues = [];
  for (const s of report.sections || []) {
    issues.push(...(s.section?.issues || []));
    issues.push(...(s.structuralIssues || []));
    issues.push(...(s.subElementIssues || []));
  }
  return [{
    viewportName: report.device,
    width: report.viewport?.width || 0,
    height: report.viewport?.height || 0,
    device: report.device,
    route: '/',
    sectionCount: report.sectionCount || 0,
    issues,
    footerIssue: report.footerIssue || '',
    safeAreaInsets: report.safeAreaInsets || null,
  }];
}

/**
 * Report chrome-stress: `cases[{name,width,height,issueCount,failures}]`.
 * Ogni caso è una viewport stress; le failure sono errori strutturali.
 */
function normalizeChromeReport(report) {
  const entries = [];
  for (const c of report.cases || []) {
    const issues = (c.failures || []).map((f) => ({ severity: 'error', message: f }));
    entries.push({
      viewportName: `${c.name} ${c.width}x${c.height}`,
      width: c.width,
      height: c.height,
      device: report.device,
      route: '/',
      sectionCount: null,
      issues,
    });
  }
  return entries;
}

/**
 * Report del gate strutturale: `viewports[{viewport,width,height,project,pass,sections}]`.
 */
function normalizeStructuralReport(report) {
  const entries = [];
  for (const v of report.viewports || []) {
    const issues = [];
    for (const s of v.sections || []) {
      for (const msg of s.issues || []) {
        issues.push({ severity: 'error', message: `[section #${s.index}] ${msg}` });
      }
    }
    entries.push({
      viewportName: `${v.viewport} (${v.project})`,
      width: v.width,
      height: v.height,
      device: v.project,
      route: '/',
      sectionCount: (v.sections || []).length,
      issues,
      pass: v.pass,
    });
  }
  return { entries, totals: report.totals };
}

// ─── Definizione suite ──────────────────────────────────────────────────────

const SUITES = [
  {
    id: 'visual-audit',
    label: 'Audit completo (9 route × 3 viewport)',
    command: 'npm run visual:audit',
    pattern: 'tests/e2e/visual-audit/report.json',
    normalize: (report) => ({ entries: normalizeRoutesReport(report) }),
  },
  {
    id: 'visual-audit-admin',
    label: 'Audit admin (6 route × 3 viewport)',
    command: 'npm run visual:audit:admin',
    pattern: 'tests/e2e/visual-audit/report-admin.json',
    normalize: (report) => ({ entries: normalizeRoutesReport(report) }),
  },
  {
    id: 'visual-audit-homepage',
    label: 'Audit homepage responsive (6 viewport × 9 sezioni + score)',
    command: 'npm run visual:audit:homepage',
    pattern: 'tests/e2e/visual-audit-homepage/report.json',
    normalize: (report) => ({
      entries: normalizeRoutesReport(report),
      score: report.responsivenessSummary?.score,
      summary: report.responsivenessSummary,
    }),
  },
  {
    id: 'visual-audit-ios',
    label: 'Audit iOS (7 device WebKit)',
    command: 'npm run visual:audit:ios',
    pattern: 'tests/e2e/visual-audit-homepage-ios/report-*.json',
    normalize: (report) => ({ entries: normalizeRoutesReport(report, true) }),
  },
  {
    id: 'visual-audit-ios-safearea',
    label: 'Audit iOS safe-area (7 device WebKit)',
    command: 'npm run visual:audit:ios:safearea',
    pattern: 'tests/e2e/visual-audit-homepage-ios/safe-area/report-*.json',
    normalize: (report) => ({ entries: normalizeSafeAreaReport(report) }),
  },
  {
    id: 'visual-audit-ios-chrome',
    label: 'Audit iOS viewport/chrome stress (7 device WebKit)',
    command: 'npm run visual:audit:ios:chrome',
    pattern: 'tests/e2e/visual-audit-homepage-ios/chrome-stress/report-*.json',
    normalize: (report) => ({ entries: normalizeChromeReport(report) }),
  },
  {
    id: 'responsive-structural',
    label: 'Gate strutturale P0 (6 viewport × chromium + mobile-webkit)',
    command: 'npm run test:e2e (responsive-structural.spec.ts)',
    pattern: 'tests/e2e/responsive-structural/report.json',
    normalize: (report) => normalizeStructuralReport(report),
  },
];

// ─── Elaborazione ───────────────────────────────────────────────────────────

const suitesResult = {};
const allViewports = [];
const overallTotals = { errors: 0, warnings: 0, infos: 0 };
const missing = [];

for (const suite of SUITES) {
  const paths = globReports(suite.pattern);
  if (paths.length === 0) {
    missing.push(suite.id);
    suitesResult[suite.id] = {
      label: suite.label,
      command: suite.command,
      status: 'missing',
      reportPaths: [],
      viewportCount: 0,
      entries: [],
      totals: { errors: 0, warnings: 0, infos: 0 },
    };
    continue;
  }

  const entries = [];
  let score = null;
  let summary = null;
  let structural = null;
  const suiteTotals = { errors: 0, warnings: 0, infos: 0 };

  for (const p of paths) {
    const report = readJson(join(ROOT, p));
    const normalized = suite.normalize(report);
    for (const e of normalized.entries) {
      entries.push({ ...e, suite: suite.id, reportPath: p });
      const c = countIssues(e.issues);
      addCounts(suiteTotals, c);
    }
    if (normalized.score) score = normalized.score;
    if (normalized.summary) summary = normalized.summary;
    if (normalized.totals) structural = normalized.totals;
  }

  addCounts(overallTotals, suiteTotals);
  suitesResult[suite.id] = {
    label: suite.label,
    command: suite.command,
    status: 'generated',
    reportPaths: paths,
    viewportCount: entries.length,
    score: score ?? null,
    responsivenessSummary: summary,
    structuralTotals: structural,
    totals: suiteTotals,
    entries,
  };

  for (const e of entries) {
    allViewports.push({
      suite: suite.id,
      viewportName: e.viewportName,
      width: e.width,
      height: e.height,
      device: e.device ?? null,
      route: e.route ?? '/',
      pass: e.pass ?? null,
      footerIssue: e.footerIssue ?? null,
      sectionCount: e.sectionCount ?? null,
      issues: countIssues(e.issues),
    });
  }
}

const summaryJson = {
  generatedAt: new Date().toISOString(),
  suites: suitesResult,
  overall: {
    suitesTotal: SUITES.length,
    suitesGenerated: SUITES.length - missing.length,
    missingSuites: missing,
    viewportsAnalyzedCount: allViewports.length,
    viewportsAnalyzed: allViewports,
    totals: overallTotals,
    homepageResponsiveScore: suitesResult['visual-audit-homepage']?.score ?? null,
  },
};

// ─── Output ─────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summaryJson, null, 2));

// Markdown leggibile
const line = (s = '') => s;
const md = [];
md.push('# Fantacer — Riepilogo Audit Visuali');
md.push('');
md.push(`Generato il ${new Date(summaryJson.generatedAt).toISOString()}.`);
md.push('');
md.push(`Suite generate: **${summaryJson.overall.suitesGenerated}/${summaryJson.overall.suitesTotal}** · Viewport/device analizzati: **${allViewports.length}** · Issue totali: **${overallTotals.errors} errori / ${overallTotals.warnings} warning / ${overallTotals.infos} info**.`);
if (summaryJson.overall.homepageResponsiveScore) {
  md.push('');
  md.push(`Score responsive homepage: **${summaryJson.overall.homepageResponsiveScore}**.`);
}
if (missing.length) {
  md.push('');
  md.push(`**Suite non generate:** ${missing.map((m) => `\`${m}\``).join(', ')}. Eseguire i relativi comandi e rigenerare il riepilogo.`);
}
md.push('');
md.push('## Suite');
md.push('');
md.push('| Suite | Comando | Stato | Viewport/device | Errori | Warning | Info | Note |');
md.push('|---|---|---|---|---|---|---|---|');
for (const s of SUITES) {
  const r = suitesResult[s.id];
  const note = r.status === 'missing' ? 'non eseguita' : (r.score ? `score ${r.score}` : '');
  md.push(line(`| ${r.label} | \`${r.command}\` | ${r.status} | ${r.viewportCount} | ${r.totals.errors} | ${r.totals.warnings} | ${r.totals.infos} | ${note} |`));
}
if (suitesResult['responsive-structural']?.structuralTotals) {
  const st = suitesResult['responsive-structural'].structuralTotals;
  md.push('');
  md.push(`Gate strutturale: **${st.passed}/${st.runs} viewport superati** (${st.failed} falliti).`);
}
md.push('');
md.push('## Viewport / device analizzati');
md.push('');
md.push('| Suite | Viewport / device | Larghezza | Altezza | Route | Errori | Warning | Info | Pass |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const v of allViewports) {
  md.push(line(`| ${v.suite} | ${v.viewportName} | ${v.width} | ${v.height} | ${v.route} | ${v.issues.errors} | ${v.issues.warnings} | ${v.issues.infos} | ${v.pass === null ? '-' : v.pass ? '✅' : '❌'} |`));
}
writeFileSync(join(OUT_DIR, 'summary.md'), md.join('\n'));

console.log(`Riepilogo scritto in ${OUT_DIR}`);
console.log(`Suite generate: ${summaryJson.overall.suitesGenerated}/${summaryJson.overall.suitesTotal}`);
console.log(`Viewport/device: ${allViewports.length}`);
console.log(`Issue totali: ${overallTotals.errors} errori, ${overallTotals.warnings} warning, ${overallTotals.infos} info`);
