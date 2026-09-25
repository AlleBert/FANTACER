#!/usr/bin/env node
/**
 * Trim dei voti sospetti con BACKUP OBBLIGATORIO prima di qualunque scrittura.
 *
 * Uso:
 *   node scripts/admin/trim-votes.mjs [--day=2026-09-23] [--top=6] [--apply]
 *
 * Senza `--apply` esegue solo backup + dry-run (nessuna cancellazione).
 *
 * Ordine operativo (non negoziabile):
 *   1. ricalcola il set A/B/C filtrato alle top-N (include voti trascinati);
 *   2. BACKUP su disco di tutte le vote_sessions del giorno + lista id + hash;
 *   3. (solo con --apply) DELETE per id -> trigger aggiornano company_totals/ranking_tick;
 *   4. ricalcolo daily_stats del giorno;
 *   5. audit_logs admin_votes_trim;
 *   6. verifica: company_totals == aggregato da vote_sessions.
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
  fetchAll,
  del,
  insert,
  palletsByCompany,
} from '../analysis/suspicious-votes-lib.mjs'

const args = parseArgs(process.argv.slice(2))
const day = args.day || DEFAULT_DAY
const topN = Number(args.top || 6)
const apply = Boolean(args.apply)

const env = loadEnv()
const c = client(env)
const sessions = await fetchDay(c, day)
const headless = await fetchHeadlessFingerprints(c, day)
const sets = classify(sessions, headless)
const { set } = buildTrimSet(sessions, sets, topN, true)
const ids = [...set].sort((a, b) => a - b)
const { rows } = impact(sessions, set)

console.log(`Giorno ${day} — voti totali ${sessions.length}`)
console.log(`A=${sets.A.size} B=${sets.B.size} C=${sets.C.size} -> set finale ${ids.length}`)
console.log('Impatto (pallets prima -> dopo):')
for (const r of rows.filter((x) => x.before !== x.after).sort((a, b) => a.after - a.before - (b.after - b.before)).slice(0, 20)) {
  console.log(`  ${r.id}  ${r.before} -> ${r.after}`)
}

// ---- 1. BACKUP OBBLIGATORIO ----------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const dir = `backups/trim-${day}-${ts}`
mkdirSync(dir, { recursive: true })
writeFileSync(`${dir}/vote_sessions.json`, JSON.stringify(sessions, null, 2))
writeFileSync(`${dir}/ids.json`, JSON.stringify(ids, null, 2))
const hash = sha256(ids)
writeFileSync(
  `${dir}/meta.json`,
  JSON.stringify(
    { day, topN, categories: ['A', 'B', 'C'], includeDragged: true, count: ids.length, sha256: hash, createdAt: new Date().toISOString(), applied: false },
    null,
    2,
  ),
)
console.log(`\nBACKUP scritto: ${dir} (${sessions.length} sessioni, ${ids.length} id, sha256 ${hash.slice(0, 16)}…)`)

if (!apply) {
  console.log('\nDry-run: nessuna scrittura. Rilancia con --apply per eseguire il taglio.')
  process.exit(0)
}

// ---- 2. DELETE -----------------------------------------------------------
console.log(`\nEseguo DELETE di ${ids.length} voti…`)
const chunk = 100
for (let i = 0; i < ids.length; i += chunk) {
  const part = ids.slice(i, i + chunk)
  await del(c, 'vote_sessions', `id=in.(${part.join(',')})`)
  console.log(`  cancellati ${Math.min(i + chunk, ids.length)}/${ids.length}`)
}

// ---- 3. RICALCOLO daily_stats -------------------------------------------
console.log('\nRicalcolo daily_stats…')
const remainingDay = await fetchDay(c, day)
const counts = {}
for (const r of remainingDay) {
  for (const id of [r.company1_id, r.company2_id, r.company3_id]) counts[id] = (counts[id] || 0) + 1
}
const existing = await fetchAll(c, `daily_stats?select=company_id,view_count&date=eq.${day}`)
const viewMap = Object.fromEntries(existing.map((r) => [r.company_id, r.view_count || 0]))
const companyIds = new Set([...Object.keys(counts), ...existing.map((r) => r.company_id)])
await del(c, 'daily_stats', `date=eq.${day}`)
const dsRows = [...companyIds].map((company_id) => ({
  company_id,
  date: day,
  vote_count: counts[company_id] || 0,
  unique_voters: counts[company_id] || 0,
  view_count: viewMap[company_id] || 0,
}))
await insert(c, 'daily_stats', dsRows)
console.log(`  daily_stats: ${dsRows.length} righe`)

// ---- 4. AUDIT ------------------------------------------------------------
await insert(c, 'audit_logs', [
  {
    event_type: 'admin_votes_trim',
    ip_address: null,
    metadata: {
      day,
      topN,
      categories: ['A', 'B', 'C'],
      includeDragged: true,
      votes_deleted: ids.length,
      ids_sha256: hash,
      backup_dir: dir,
      executed_at: new Date().toISOString(),
    },
  },
])
console.log('  audit_logs: admin_votes_trim scritto')

// ---- 5. VERIFICA ---------------------------------------------------------
console.log('\nVerifica company_totals vs aggregato vote_sessions…')
const allSessions = await fetchAll(c, 'vote_sessions?select=company1_id,company2_id,company3_id')
const expected = palletsByCompany(allSessions)
const totals = await fetchAll(c, 'company_totals?select=company_id,total_pallets')
let mismatch = 0
for (const t of totals) {
  const exp = expected[t.company_id] || 0
  if (Number(t.total_pallets) !== exp) {
    mismatch++
    if (mismatch <= 10) console.log(`  MISMATCH ${t.company_id}: company_totals=${t.total_pallets} atteso=${exp}`)
  }
}
console.log(mismatch === 0 ? `  OK: ${totals.length} aziende coerenti` : `  ATTENZIONE: ${mismatch} mismatch`)

writeFileSync(
  `${dir}/meta.json`,
  JSON.stringify(
    { day, topN, categories: ['A', 'B', 'C'], includeDragged: true, count: ids.length, sha256: hash, createdAt: new Date().toISOString(), applied: true, votes_deleted: ids.length, mismatch },
    null,
    2,
  ),
)
console.log(`\nFatto. Backup/rollback in ${dir}`)
