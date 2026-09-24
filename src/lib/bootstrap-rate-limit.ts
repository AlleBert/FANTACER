import { checkRateLimit } from '@/lib/rate-limit'

/**
 * P0-4c — Rate limit del bootstrap pre-sessione su IP attendibile.
 *
 * Semantica identica a `vote-rate-limit`: due modalità
 * - `observe` (default): calcola e **registra** senza bloccare;
 * - `enforce`: blocca (429 + Retry-After).
 *
 * Il deploy iniziale resta in `observe` per misurare i falsi positivi su reti
 * mobili/CGNAT prima di attivare `enforce`. Chiave pseudonimizzata
 * (`bootstrap:ip:<hmacIp>`): mai l'IP grezzo.
 */

export type BootstrapRateLimitMode = 'observe' | 'enforce'

export const BOOTSTRAP_RATE_WINDOW_MS = 10 * 60 * 1000
export const BOOTSTRAP_RATE_IP_MAX = 10

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

export function bootstrapRateWindowMs(): number {
  return positiveIntEnv('BOOTSTRAP_RATE_WINDOW_MS', BOOTSTRAP_RATE_WINDOW_MS)
}

export function bootstrapRateIpMax(): number {
  return positiveIntEnv('BOOTSTRAP_RATE_IP_MAX', BOOTSTRAP_RATE_IP_MAX)
}

export function bootstrapRateLimitMode(): BootstrapRateLimitMode {
  return process.env.BOOTSTRAP_RATE_LIMIT_MODE === 'enforce' ? 'enforce' : 'observe'
}

export type BootstrapRateCheck = (key: string, windowMs: number, max: number) => Promise<boolean>

export interface BootstrapRateDecision {
  mode: BootstrapRateLimitMode
  /** Esito applicato al percorso (observe ⇒ sempre `true`). */
  allowed: boolean
  /** Esito reale del calcolo, per la telemetria. */
  rawAllowed: boolean
  retryAfterSec: number
  /** Chiave pseudonimizzata usata, o `null` se nessun IP attendibile. */
  key: string | null
}

const defaultCheck: BootstrapRateCheck = (key, windowMs, max) => checkRateLimit(key, windowMs, max)

export async function evaluateBootstrapRateLimit(params: {
  ipHash: string | null
  check?: BootstrapRateCheck
}): Promise<BootstrapRateDecision> {
  const mode = bootstrapRateLimitMode()
  const windowMs = bootstrapRateWindowMs()
  const retryAfterSec = Math.ceil(windowMs / 1000)

  if (!params.ipHash) {
    return { mode, allowed: true, rawAllowed: true, retryAfterSec, key: null }
  }

  const key = `bootstrap:ip:${params.ipHash}`
  const check = params.check ?? defaultCheck
  const rawAllowed = await check(key, windowMs, bootstrapRateIpMax())
  const allowed = mode === 'observe' ? true : rawAllowed

  if (!rawAllowed) {
    // Non loggare chiavi/valori: solo ambito ed esito.
    console.warn('[bootstrap-rate] would-block', { mode, scope: 'ip', allowed: rawAllowed })
  }

  return { mode, allowed, rawAllowed, retryAfterSec, key }
}
