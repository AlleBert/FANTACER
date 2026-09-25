#!/usr/bin/env node
/**
 * Libreria condivisa per il rilevamento e il taglio dei voti sospetti.
 *
 * Regola di sicurezza: questo modulo parla SOLO con il progetto production
 * (`zdfverdwdsigizxktilz`), letto da `.env` con la service_role. Il guard
 * fail-fast impedisce di puntare ad altri progetti.
 */
import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'dotenv'
import { createHash } from 'node:crypto'

export const PROD_HOST = 'zdfverdwdsigizxktilz.supabase.co'
export const DEFAULT_DAY = '2026-09-23'

export function fail(msg) {
  console.error('\nError:', msg)
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

export function loadEnv() {
  if (!existsSync('.env')) fail('.env mancante')
  const env = parse(readFileSync('.env', 'utf8'))
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in .env')
  let host
  try {
    host = new URL(url).hostname
  } catch {
    fail(`URL non valida: ${url}`)
  }
  if (host !== PROD_HOST) fail(`Guard: URL = ${host}, atteso ${PROD_HOST}`)
  return { url, key }
}

export function client({ url, key }) {
  return {
    url,
    key,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }
}

async function request(c, path, opts = {}) {
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    ...opts,
    headers: { ...c.headers, ...(opts.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status} ${body}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/** GET paginato (PostgREST limita a 1000 righe per richiesta). */
export async function fetchAll(c, path, pageSize = 1000) {
  const out = []
  let offset = 0
  for (;;) {
    const sep = path.includes('?') ? '&' : '?'
    const batch = await request(c, `${path}${sep}limit=${pageSize}&offset=${offset}`)
    out.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }
  return out
}

export async function del(c, table, filter) {
  await request(c, `${table}?${filter}`, { method: 'DELETE' })
}

export async function insert(c, table, rows, extra = {}) {
  if (!rows.length) return
  await request(c, table, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal', ...extra },
    body: JSON.stringify(rows),
  })
}

export function sha256(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

export function deviceClass(ua) {
  ua = ua || ''
  if (/Instagram/.test(ua)) return 'Instagram'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  return 'other'
}

/** Carica i voti del giorno ordinati per created_at. */
export async function fetchDay(c, day) {
  const rows = await fetchAll(
    c,
    `vote_sessions?select=id,fingerprint,ip_hash,user_agent,country,company1_id,company2_id,company3_id,created_at,vote_day&vote_day=eq.${day}&order=created_at.asc`,
  )
  return rows.map((r) => ({ ...r, t: +new Date(r.created_at) }))
}

/** Fingerprint con botd headless rilevato nel periodo del giorno. */
export async function fetchHeadlessFingerprints(c, day) {
  const start = new Date(`${day}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 1)
  const gte = start.toISOString()
  const rows = await fetchAll(
    c,
    `audit_logs?select=fingerprint,metadata&event_type=eq.vote_submitted&created_at=gte.${gte}&order=created_at.asc`,
  )
  const set = new Set()
  for (const r of rows) {
    const v = r.metadata && r.metadata.botd
    if (typeof v === 'string' && v.includes('headless')) set.add(r.fingerprint)
  }
  return set
}

export function classify(sessions, headlessFps) {
  const A = new Set()
  const B = new Set()
  const C = new Set()
  for (const r of sessions) if (headlessFps.has(r.fingerprint)) A.add(r.id)

  const win = sessions
    .filter((r) => /Windows NT/.test(r.user_agent || ''))
    .sort((a, b) => a.t - b.t)
  if (win.length) {
    let cur = [win[0]]
    for (let i = 1; i < win.length; i++) {
      const gap = (win[i].t - win[i - 1].t) / 1000
      if (gap <= 180 && win[i].company1_id === win[i - 1].company1_id) cur.push(win[i])
      else {
        if (cur.length >= 3) for (const r of cur) B.add(r.id)
        cur = [win[i]]
      }
    }
    if (cur.length >= 3) for (const r of cur) B.add(r.id)
  }

  const s = [...sessions].sort((a, b) => a.t - b.t)
  for (let i = 1; i < s.length; i++) {
    const gap = (s[i].t - s[i - 1].t) / 1000
    if (gap <= 2) {
      C.add(s[i].id)
      C.add(s[i - 1].id)
    }
  }
  return { A, B, C }
}

export function palletsByCompany(sessions) {
  const acc = {}
  for (const r of sessions) {
    for (const [id, p] of [
      [r.company1_id, 4],
      [r.company2_id, 2],
      [r.company3_id, 1],
    ]) {
      acc[id] = (acc[id] || 0) + p
    }
  }
  return acc
}

export function ranking(sessions) {
  const acc = palletsByCompany(sessions)
  return Object.entries(acc)
    .sort((a, b) => b[1] - a[1])
    .map(([id, p]) => ({ id, p }))
}

/**
 * Costruisce il set di taglio: unione di A/B/C, filtrata ai voti che toccano
 * almeno una delle prime `topN` aziende (per includere i voti "trascinati"
 * in cui le top-N compaiono come 2ª/3ª scelta).
 */
export function buildTrimSet(sessions, sets, topN, includeDragged = true) {
  const rank = ranking(sessions)
  const top = new Set(rank.slice(0, topN).map((x) => x.id))
  const auto = new Set([...sets.A, ...sets.B, ...sets.C])
  const byId = new Map(sessions.map((r) => [r.id, r]))
  const set = new Set()
  for (const id of auto) {
    const r = byId.get(id)
    if (!r) continue
    const touched = top.has(r.company1_id) || top.has(r.company2_id) || top.has(r.company3_id)
    const first = top.has(r.company1_id)
    if (includeDragged ? touched : first) set.add(id)
  }
  return { set, top }
}

export function impact(sessions, ids) {
  const before = ranking(sessions)
  const kept = sessions.filter((r) => !ids.has(r.id))
  const after = ranking(kept)
  const beforeMap = Object.fromEntries(before.map((x, i) => [x.id, { p: x.p, pos: i + 1 }]))
  const afterMap = Object.fromEntries(after.map((x, i) => [x.id, { p: x.p, pos: i + 1 }]))
  const companies = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])
  const rows = [...companies].map((id) => ({
    id,
    before: beforeMap[id]?.p ?? 0,
    after: afterMap[id]?.p ?? 0,
    posBefore: beforeMap[id]?.pos ?? null,
    posAfter: afterMap[id]?.pos ?? null,
  }))
  return { rows, before, after }
}
