#!/usr/bin/env node
/**
 * Helper condivisi per seed/cleanup del load test.
 *
 * Regola di sicurezza: le chiavi di production vengono usate SOLO in lettura
 * (`.env`), il target di scrittura e' sempre `fantacer-e2e` (`.env.e2e`).
 * Entrambi gli host sono validati con fail-fast prima di qualunque query.
 */
import { createClient } from '@supabase/supabase-js'
import { parse } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'

export const PROD_HOST = 'zdfverdwdsigizxktilz.supabase.co'
export const E2E_HOST = 'ookipybsnjtvdrzqzpsl.supabase.co'
export const STATE_DIR = '.loadtest'
export const STATE_FILE = `${STATE_DIR}/state.json`
export const SEED_PREFIX = 'seed-loadtest-'
export const LOAD_PREFIX = 'loadtest-'

export function fail(message) {
  console.error('\nError:', message)
  process.exit(1)
}

export function parseArgs(argv) {
  const out = {}
  for (const raw of argv) {
    const m = raw.match(/^--([a-z-]+)(?:=(.*))?$/)
    if (!m) fail(`Argomento non riconosciuto: ${raw}`)
    out[m[1]] = m[2] === undefined ? true : m[2]
  }
  return out
}

function readEnvFile(path) {
  if (!existsSync(path)) fail(`File env mancante: ${path}`)
  return parse(readFileSync(path, 'utf8'))
}

function guardHost(url, expected, label) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    fail(`URL ${label} non valida: ${url}`)
  }
  if (host !== expected) {
    fail(`Guard: URL ${label} = ${host}, atteso ${expected}`)
  }
  return host
}

/** Credenziali: prod (read-only) da `.env`, target (write) da `.env.e2e`. */
export function loadCreds() {
  const prod = readEnvFile('.env')
  const e2e = readEnvFile('.env.e2e')
  const prodUrl = prod.NEXT_PUBLIC_SUPABASE_URL
  const e2eUrl = e2e.NEXT_PUBLIC_SUPABASE_URL
  guardHost(prodUrl, PROD_HOST, 'production (.env)')
  guardHost(e2eUrl, E2E_HOST, 'fantacer-e2e (.env.e2e)')
  if (!prod.SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY mancante in .env')
  if (!e2e.SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY mancante in .env.e2e')
  return {
    prod: { url: prodUrl, key: prod.SUPABASE_SERVICE_ROLE_KEY },
    e2e: { url: e2eUrl, key: e2e.SUPABASE_SERVICE_ROLE_KEY },
  }
}

export function adminClient({ url, key }) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function readState() {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

export function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

export function clearState() {
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE)
}

export async function countRows(db, table, build) {
  let query = db.from(table).select('*', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  if (error) fail(`count ${table}: ${error.message}`)
  return count
}
