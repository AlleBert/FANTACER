#!/usr/bin/env node
/**
 * Detector read-only dei voti sospetti (categorie A/B/C) su un giorno.
 *
 * Uso:
 *   node scripts/analysis/detect-suspicious-votes.mjs \
 *     [--day=2026-09-23] [--top=6] [--out=./trim-report]
 *
 * Categorie:
 *   A = botd headless_chrome
 *   B = voti Windows in catena (stesso company1, gap <=180s, len >=3)
 *   C = coppie consecutive con gap <=2s (entrambi i lati)
 *
 * Nessuna scrittura su DB.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  DEFAULT_DAY,
  parseArgs,
  loadEnv,
  client,
  fetchDay,
  fetchHeadlessFingerprints,
  classify,
  buildTrimSet,
  impact,
  sha256,
  deviceClass,
} from './suspicious-votes-lib.mjs'

const args = parseArgs(process.argv.slice(2))
const day = args.day || DEFAULT_DAY
const topN = Number(args.top || 6)
const outDir = args.out || './trim-report'

const env = loadEnv()
const c = client(env)
const sessions = await fetchDay(c, day)
const headless = await fetchHeadlessFingerprints(c, day)
const sets = classify(sessions, headless)

console.log(`Giorno: ${day} — voti: ${sessions.length}`)
console.log(`A(headless)=${sets.A.size}  B(Windows catene)=${sets.B.size}  C(gap<=2s)=${sets.C.size}`)

const { set, top } = buildTrimSet(sessions, sets, topN, true)
const { rows } = impact(sessions, set)

const byId = new Map(sessions.map((r) => [r.id, r]))
const dev = {}
for (const id of set) {
  const k = deviceClass(byId.get(id)?.user_agent)
  dev[k] = (dev[k] || 0) + 1
}

console.log(`Top${topN}: ${[...top].join(', ')}`)
console.log(`Set di taglio (company1/2/3 nelle top${topN}): ${set.size} voti`)
console.log(`Device: ${JSON.stringify(dev)}`)
console.log('\nAziende toccate (pallets prima -> dopo):')
for (const r of rows.filter((x) => x.before !== x.after).sort((a, b) => a.after - a.before - (b.after - b.before))) {
  console.log(`  ${r.id}  ${r.before} -> ${r.after}  (#${r.posBefore} -> #${r.posAfter})`)
}

mkdirSync(outDir, { recursive: true })
const ids = [...set].sort((a, b) => a - b)
writeFileSync(`${outDir}/ids.json`, JSON.stringify(ids, null, 2))
writeFileSync(
  `${outDir}/meta.json`,
  JSON.stringify(
    { day, topN, categories: ['A', 'B', 'C'], includeDragged: true, count: ids.length, sha256: sha256(ids), generatedAt: new Date().toISOString() },
    null,
    2,
  ),
)
writeFileSync(`${outDir}/impact.json`, JSON.stringify(rows, null, 2))
console.log(`\nScritto: ${outDir}/ids.json (${ids.length}, sha256 ${sha256(ids).slice(0, 16)}…)`)
