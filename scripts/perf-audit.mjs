#!/usr/bin/env node
/**
 * Analisi performance combinata: bundle + re-render → report.
 *
 * Esegue le 2 pratiche (vedi README §Performance):
 *  1. Bundle analysis  → build webpack con ANALYZE=true → .next/analyze/*.html
 *  2. react-scan       → avvia next dev, raccoglie le metriche di re-render su un
 *                        journey utente reale via Playwright
 * Poi aggrega entrambe in un report riassuntivo in perf-output/.
 *
 * Uso: npm run perf:report
 */
import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { collect } from './perf-react-scan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'perf-output');
const PORT = process.env.PERF_PORT || '3100';
const BASE_URL = `http://localhost:${PORT}`;

const log = (msg) => console.log(`\n[perf] ${msg}`);

function waitForServer(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`timeout aspettando ${url}`));
          } else {
            setTimeout(attempt, 1500);
          }
        });
    };
    attempt();
  });
}

async function step1Bundle() {
  log('1/3 Bundle analysis (build webpack con ANALYZE=true)...');
  execSync('npm run analyze', { cwd: root, stdio: 'inherit', env: process.env });
  mkdirSync(OUT_DIR, { recursive: true });
  const analyzeDir = join(root, '.next', 'analyze');
  if (existsSync(analyzeDir)) {
    for (const f of readdirSync(analyzeDir)) {
      copyFileSync(join(analyzeDir, f), join(OUT_DIR, `bundle-${f}`));
    }
    log(`Report bundle salvati in ${OUT_DIR}/bundle-*.html`);
  } else {
    log('ATTENZIONE: nessun report bundle generato in .next/analyze');
  }
}

async function step2ReactScan() {
  log(`2/3 react-scan: avvio next dev su :${PORT}...`);
  const child = spawn('npx', ['next', 'dev', '-p', PORT], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'development' },
    detached: true,
  });
  try {
    await waitForServer(BASE_URL);
    log('Server pronto. Raccogliendo metriche re-render (journey utente)...');
    const report = await collect(BASE_URL, join(OUT_DIR, 'react-scan-report.json'));
    log(`react-scan: ${Object.keys(report).length} stadi raccolti → perf-output/react-scan-report.json`);
  } finally {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function step3Report() {
  log('3/3 Generazione report riassuntivo...');
  let reactScan = {};
  try {
    reactScan = JSON.parse(readFileSync(join(OUT_DIR, 'react-scan-report.json'), 'utf8'));
  } catch {}

  // Aggrega i re-render su tutto il journey
  const agg = {};
  for (const list of Object.values(reactScan)) {
    for (const c of list) {
      if (!agg[c.name]) agg[c.name] = { count: 0, timeMs: 0 };
      agg[c.name].count += c.count;
      agg[c.name].timeMs += c.timeMs;
    }
  }
  const topRenders = Object.entries(agg)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count || b.timeMs - a.timeMs)
    .slice(0, 25);

  const reportPath = join(OUT_DIR, 'perf-report.md');
  const lines = [];
  lines.push('# Report Performance (perf:report)');
  lines.push('');
  lines.push(`Generato: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## 1. Bundle (webpack analyzer)');
  lines.push('');
  lines.push('I report interattivi sono in `perf-output/bundle-*.html`.');
  lines.push('Per i dettagli di moduli/pacchetti aprire `bundle-client.html` nel browser.');
  lines.push('');
  lines.push('## 2. Re-render (react-scan)');
  lines.push('');
  lines.push('Top componenti per numero di re-render cumulati sul journey (scroll + ricerca + select + resize):');
  lines.push('');
  lines.push('| Componente | Rendering | Tempo (ms) |');
  lines.push('|---|---|---|');
  for (const r of topRenders) {
    lines.push(`| ${r.name} | ${r.count} | ${Math.round(r.timeMs * 100) / 100} |`);
  }
  lines.push('');
  lines.push('Dati completi per stadio in `perf-output/react-scan-report.json`.');
  lines.push('');
  lines.push('> Nota: l\'analisi è **locale/on-demand** (non in CI). `afterLoad` misura solo i re-render successivi al mount.');
  writeFileSync(reportPath, lines.join('\n'));
  log(`Report salvato in ${reportPath}`);
}

(async () => {
  await step1Bundle();
  await step2ReactScan();
  await step3Report();
  log('Fatto. Output in perf-output/: bundle-*.html, react-scan-report.json, perf-report.md');
})().catch((e) => {
  console.error('\n[perf] ERRORE:', e.message);
  process.exit(1);
});
