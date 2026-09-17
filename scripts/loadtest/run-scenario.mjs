#!/usr/bin/env node
/**
 * Wrapper di uno scenario k6 con monitoraggio DB automatico.
 *
 * Avvia `db-monitor.mjs`, esegue `k6 run` con output CSV + summary JSON,
 * ferma il sampler e produce `summary.md` con i delta DB allineati al run.
 *
 * Usage:
 *   npm run load:run -- smoke
 *   npm run load:run -- baseline
 *   npm run load:run -- spike|soak|realtime
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail } from './lib.mjs'

const SCENARIOS = ['smoke', 'baseline', 'spike', 'soak', 'realtime']

const scenario = process.argv[2]
if (!scenario || scenario.startsWith('--')) fail(`Uso: npm run load:run -- <${SCENARIOS.join('|')}>`)
if (!SCENARIOS.includes(scenario)) fail(`Scenario sconosciuto: ${scenario}. Attesi: ${SCENARIOS.join(', ')}`)

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const RUN_ID = process.env.RUN_ID || 'manual'
const INTERVAL = process.env.SAMPLE_MS || '10000'
const scenarioPath = resolve('tests/load/scenarios', `${scenario}.js`)
if (!existsSync(scenarioPath)) fail(`Scenario file non trovato: ${scenarioPath}`)

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const outDir = resolve('loadtest-output', `${scenario}-${stamp()}`)
mkdirSync(outDir, { recursive: true })

const log = (...a) => console.log('[load:run]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function spawnAsync(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
  return new Promise((res) => child.on('exit', (code, signal) => res({ code, signal, child })))
}

async function waitForFile(path, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (existsSync(path)) return true
    await sleep(200)
  }
  return false
}

function readNdjson(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function readJson(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function pct(clamped) {
  return (clamped * 100).toFixed(1) + '%'
}

function buildSummary({ k6, samples, pgssBefore, pgssAfter, exit, startedAt, endedAt }) {
  const L = []
  const first = samples[0]
  const last = samples[samples.length - 1]
  const num = (v) => Number(v || 0)
  const delta = (k) => num(last?.[k]) - num(first?.[k])
  const peak = (k) => samples.reduce((m, s) => Math.max(m, num(s[k])), 0)
  const durS = ((new Date(endedAt) - new Date(startedAt)) / 1000).toFixed(0)

  L.push(`# Load run: ${scenario}`, '')
  L.push(`- Avvio: ${startedAt}`)
  L.push(`- Fine: ${endedAt} (durata ${durS}s)`)
  L.push(`- BASE_URL: ${BASE_URL} | RUN_ID: ${RUN_ID} | k6 exit: ${exit}`, '')

  L.push('## k6', '')
  if (k6?.metrics) {
    const reqs = k6.metrics.http_reqs || {}
    const failed = k6.metrics.http_req_failed || {}
    const global = k6.metrics.http_req_duration || {}
    const failRate = failed.value ?? failed.rate ?? 0
    L.push(`- richieste: ${num(reqs.count)}`)
    L.push(`- error rate: ${pct(num(failRate))}`)
    L.push(`- globale: avg ${num(global.avg).toFixed(0)}ms | p95 ${num(global['p(95)']).toFixed(0)}ms | p99 ${num(global['p(99)']).toFixed(0)}ms`)
    const endpoints = Object.keys(k6.metrics).filter((k) => k.startsWith('http_req_duration{endpoint:'))
    for (const key of endpoints) {
      const e = k6.metrics[key]
      L.push(`- ${key.replace('http_req_duration{', '').replace('}', '')}: avg ${num(e.avg).toFixed(0)}ms | p95 ${num(e['p(95)']).toFixed(0)}ms | p99 ${num(e['p(99)']).toFixed(0)}ms`)
    }
    const breached = []
    for (const [name, m] of Object.entries(k6.metrics)) {
      if (!m || !m.thresholds) continue
      for (const [th, isBreached] of Object.entries(m.thresholds)) {
        if (isBreached) breached.push(`${name}  ${th}`)
      }
    }
    if (breached.length) {
      L.push('- threshold violate:')
      for (const b of breached) L.push(`  - ${b}`)
    } else {
      L.push('- threshold: tutte rispettate')
    }
  } else {
    L.push('- summary k6 non disponibile')
  }
  L.push('')

  L.push('## DB (sampler)', '')
  if (samples.length) {
    const dHit = delta('blks_hit')
    const dRead = delta('blks_read')
    L.push(`- campioni: ${samples.length}`)
    L.push(`- connessioni: picco ${peak('conn_total')} (last: active ${num(last.conn_active)}, idle ${num(last.conn_idle)}, idle-tx ${num(last.conn_idle_tx)})`)
    L.push(`- lock bloccati (picco): ${peak('blocked_locks')} | query attive >2s (picco): ${peak('long_active')}`)
    L.push(`- transazioni: commit +${delta('xact_commit')}, rollback +${delta('xact_rollback')}`)
    L.push(`- cache hit: ${dHit + dRead ? ((dHit / (dHit + dRead)) * 100).toFixed(1) : '0'}% | blocchi letti +${dRead}`)
    L.push(`- temp_bytes: +${delta('temp_bytes')} | deadlock: +${delta('deadlocks')}`)
    L.push(`- WAL generato: +${(delta('wal_bytes') / 1024 / 1024).toFixed(1)} MB`)
    L.push('')
    L.push('### Tabelle (delta)', '')
    const names = new Set()
    for (const s of samples) for (const t of s.tables || []) names.add(t.relname)
    for (const name of names) {
      const f = (s) => (s.tables || []).find((t) => t.relname === name) || {}
      const d = (k) => num(f(last)[k]) - num(f(first)[k])
      L.push(`- ${name}: insert +${d('ins')}, delete +${d('del')}, seq scan +${d('seq')}, idx scan +${d('idx')}`)
    }
  } else {
    L.push('- nessun campione DB')
  }
  L.push('')

  L.push('## Top query per tempo DB nella finestra (pg_stat_statements delta)', '')
  if (pgssBefore && pgssAfter) {
    const before = new Map(pgssBefore.rows.map((r) => [r.queryid, r]))
    const rows = pgssAfter.rows
      .map((r) => {
        const b = before.get(r.queryid)
        return {
          query: r.query,
          dTime: num(r.total_exec_time) - num(b?.total_exec_time),
          dCalls: Math.max(0, num(r.calls) - num(b?.calls)),
        }
      })
      .filter((r) => r.dTime > 0.5)
      .sort((a, b) => b.dTime - a.dTime)
      .slice(0, 10)
    for (const r of rows) {
      L.push(`- ${r.dTime.toFixed(0)}ms (+${r.dCalls} calls) ${r.query.slice(0, 110)}`)
    }
    if (!rows.length) L.push('- nessuna query rilevante')
  } else {
    L.push('- snapshot pg_stat_statements non disponibili')
  }

  return L.join('\n')
}

async function main() {
  const startedAt = new Date().toISOString()
  log(`scenario=${scenario} out=${outDir}`)

  const monitor = spawn('node', ['scripts/loadtest/db-monitor.mjs', `--out=${outDir}`, `--interval=${INTERVAL}`], {
    stdio: 'inherit',
  })

  const ready = await waitForFile(resolve(outDir, 'pgss-before.json'), 15000)
  if (!ready) log('warning: pgss-before.json non comparso, proseguo')

  log('avvio k6...')
  const k6 = await spawnAsync('k6', [
    'run',
    '-e',
    `BASE_URL=${BASE_URL}`,
    '-e',
    `RUN_ID=${RUN_ID}`,
    '--out',
    `csv=${outDir}/k6.csv`,
    '--summary-trend-stats',
    'avg,min,med,max,p(90),p(95),p(99)',
    '--summary-export',
    `${outDir}/k6-summary.json`,
    scenarioPath,
  ])

  if (monitor.exitCode === null) {
    monitor.kill('SIGTERM')
    await new Promise((r) => monitor.on('exit', r))
  }
  const endedAt = new Date().toISOString()

  const summary = buildSummary({
    k6: readJson(`${outDir}/k6-summary.json`),
    samples: readNdjson(`${outDir}/db.ndjson`),
    pgssBefore: readJson(`${outDir}/pgss-before.json`),
    pgssAfter: readJson(`${outDir}/pgss-after.json`),
    exit: k6.code,
    startedAt,
    endedAt,
  })

  writeFileSync(`${outDir}/meta.json`, JSON.stringify({ scenario, runId: RUN_ID, baseUrl: BASE_URL, startedAt, endedAt, k6Exit: k6.code }, null, 2))
  writeFileSync(`${outDir}/summary.md`, summary)

  console.log('\n' + summary + '\n')
  log(`report: ${outDir}/summary.md`)
}

main().catch((e) => fail(e?.stack || String(e)))
