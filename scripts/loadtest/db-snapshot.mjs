#!/usr/bin/env node
/**
 * Snapshot JSON di tutte le tabelle dello schema `public` di fantacer-e2e.
 * Sola lettura: serve come rete di sicurezza prima di migrazioni/seed/cleanup.
 *
 * Usage:
 *   node scripts/loadtest/db-snapshot.mjs [--out=backups/e2e-<ts>.json]
 */
import pg from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fail, loadE2eDbUrl } from './lib.mjs'

const { Client } = pg

const args = {}
for (const raw of process.argv.slice(2)) {
  const m = raw.match(/^--([a-z-]+)=?(.*)$/)
  if (m) args[m[1]] = m[2] === '' ? true : m[2]
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const outPath = args.out ? String(args.out) : `backups/e2e-${stamp()}.json`
const client = new Client({ connectionString: loadE2eDbUrl(), ssl: { rejectUnauthorized: false } })

async function main() {
  await client.connect()
  const { rows: tables } = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )
  const snapshot = { at: new Date().toISOString(), target: 'fantacer-e2e', tables: {} }
  let total = 0
  for (const { tablename } of tables) {
    const { rows } = await client.query(`select * from public."${tablename.replace(/"/g, '')}"`)
    snapshot.tables[tablename] = rows
    total += rows.length
    console.log(`[snapshot] ${tablename}: ${rows.length}`)
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(snapshot))
  console.log(`[snapshot] scrivono ${total} righe -> ${outPath}`)
}

main()
  .catch((e) => fail(`db-snapshot: ${e.message}`))
  .finally(() => client.end().catch(() => {}))
