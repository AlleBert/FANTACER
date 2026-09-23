#!/usr/bin/env node
// Applica un file di migration via connessione diretta pg e lo registra in
// supabase_migrations.schema_migrations.
// Uso: node scripts/apply-migration.mjs <file.sql> <db-url> [ref-atteso]
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
const dbUrl = process.argv[3]
const expectRef = process.argv[4]
if (!file || !dbUrl) {
  console.error('usage: node scripts/apply-migration.mjs <file.sql> <db-url> [ref]')
  process.exit(1)
}
if (!expectRef) {
  console.error('usage: node scripts/apply-migration.mjs <file.sql> <db-url> <ref-atteso>')
  process.exit(1)
}
if (!dbUrl.includes(expectRef)) {
  console.error(`guard: la URL non contiene il ref atteso ${expectRef}`)
  process.exit(1)
}
const version = file.split('/').pop().split('_')[0]
const sql = readFileSync(file, 'utf8')
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  await client.query('begin')
  await client.query(sql)
  await client.query(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ($1, $2) on conflict (version) do nothing`,
    [version, file.split('/').pop()],
  )
  await client.query('commit')
  console.log('OK', version)
} catch (e) {
  await client.query('rollback').catch(() => {})
  console.error('FAILED', version, e.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
