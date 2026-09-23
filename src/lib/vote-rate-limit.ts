import { checkRateLimit } from '@/lib/rate-limit'

/**
 * P0-3 — Rate limit del percorso voto su segnali attendibili.
 *
 * Due modalità:
 * - `observe` (default): calcola la decisione e la **registra**, senza bloccare.
 * - `enforce`: restituisce la decisione di blocco (429 + Retry-After).
 *
 * Il deploy iniziale durante la fiera deve restare in `observe` per misurare i
 * falsi positivi su reti mobili/CGNAT prima di attivare `enforce`.
 */

export type VoteRateLimitMode = 'observe' | 'enforce'

export const VOTE_RATE_WINDOW_MS = 10 * 60 * 1000
export const VOTE_RATE_IP_MAX = 60
export const VOTE_RATE_ID_MAX = 12

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

export function voteRateWindowMs(): number {
  return positiveIntEnv('VOTE_RATE_WINDOW_MS', VOTE_RATE_WINDOW_MS)
}
export function voteRateIpMax(): number {
  return positiveIntEnv('VOTE_RATE_IP_MAX', VOTE_RATE_IP_MAX)
}
export function voteRateIdMax(): number {
  return positiveIntEnv('VOTE_RATE_ID_MAX', VOTE_RATE_ID_MAX)
}

export function voteRateLimitMode(): VoteRateLimitMode {
  return process.env.VOTE_RATE_LIMIT_MODE === 'enforce' ? 'enforce' : 'observe'
}

export type VoteRateCheck = (key: string, windowMs: number, max: number) => Promise<boolean>

export interface VoteRateScope {
  scope: 'ip' | 'id'
  key: string
  allowed: boolean
}

export interface VoteRateDecision {
  mode: VoteRateLimitMode
  /** Esito applicato al percorso (observe ⇒ sempre `true`). */
  allowed: boolean
  /** Esito reale del calcolo, per la telemetria. */
  rawAllowed: boolean
  retryAfterSec: number
  scopes: VoteRateScope[]
}

const defaultCheck: VoteRateCheck = (key, windowMs, max) => checkRateLimit(key, windowMs, max)

/**
 * Valuta i limiti per IP (se l'IP trusted esiste, via HMAC) e per identità.
 * Non registra mai l'IP grezzo: la chiave IP è già pseudonimizzata dal chiamante.
 */
export async function evaluateVoteRateLimit(params: {
  ipHash: string | null
  fingerprint: string
  check?: VoteRateCheck
}): Promise<VoteRateDecision> {
  const check = params.check ?? defaultCheck
  const windowMs = voteRateWindowMs()
  const scopes: VoteRateScope[] = []

  if (params.ipHash) {
    const key = `vote:ip:${params.ipHash}`
    scopes.push({ scope: 'ip', key, allowed: await check(key, windowMs, voteRateIpMax()) })
  }

  const idKey = `vote:id:${params.fingerprint}`
  scopes.push({ scope: 'id', key: idKey, allowed: await check(idKey, windowMs, voteRateIdMax()) })

  const rawAllowed = scopes.every((s) => s.allowed)
  const mode = voteRateLimitMode()
  const allowed = mode === 'observe' ? true : rawAllowed

  if (!rawAllowed) {
    // Non loggare chiavi/valori: solo ambito ed esito.
    console.warn('[vote-rate] would-block', {
      mode,
      scopes: scopes.map((s) => ({ scope: s.scope, allowed: s.allowed })),
    })
  }

  return { mode, allowed, rawAllowed, retryAfterSec: Math.ceil(windowMs / 1000), scopes }
}
