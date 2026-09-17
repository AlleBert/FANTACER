import http from 'k6/http'
import { BASE_URL } from '../config.js'

/** PRNG deterministico: run ripetibili a parita' di seed. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function visitorId(runId, n) {
  return `loadtest-${runId}-${n}`
}

/** Aziende del batch attivo, lette da /api/aziende (pubblico). Usata in setup(). */
export function fetchCompanies() {
  const res = http.get(`${BASE_URL}/api/aziende?limit=500`)
  if (res.status !== 200) {
    throw new Error(`fetchCompanies: /api/aziende ha risposto ${res.status}`)
  }
  const body = res.json()
  const companies = (body.data || []).map((c) => c.id)
  if (companies.length < 3) {
    throw new Error(`fetchCompanies: servono almeno 3 aziende, trovate ${companies.length}`)
  }
  return companies
}

/** Tre indici distinti (nessun vincolo di ordine). */
export function pickTriple(companies, rng) {
  const n = companies.length
  const a = Math.floor(rng() * n)
  let b = Math.floor(rng() * (n - 1))
  if (b >= a) b += 1
  let c = Math.floor(rng() * (n - 2))
  const ex = a < b ? [a, b] : [b, a]
  for (const e of ex) if (c >= e) c += 1
  return [companies[a], companies[b], companies[c]]
}
