import { randomBytes } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * P0-4c — Nonce di bootstrap pre-sessione.
 *
 * Il nonce lega il flusso Turnstile alla richiesta di bootstrap: viene emesso
 * da `GET /api/identity/bootstrap/nonce`, passato al widget come `cData`
 * (`bootstrap:<nonce>`) e consumato **una sola volta** da
 * `POST /api/identity/bootstrap` prima di creare la sessione.
 *
 * Persistenza su DB (non in-memory): la webapp gira su istanze serverless
 * effimere, quindi uno store per-istanza non è affidabile. La consumazione è
 * atomica (singola UPDATE condizionata con `RETURNING`), il che rende il
 * replay concorrente impossibile.
 *
 * Ogni nonce è legato al bucket IP pseudonimizzato (`ip_hmac`) così da poter
 * limitare i nonce in sospeso per IP.
 */

type Admin = ReturnType<typeof createAdminClient>

export const BOOTSTRAP_NONCE_TTL_MS = 120_000
export const BOOTSTRAP_CDATA_PREFIX = 'bootstrap:'
export const BOOTSTRAP_NONCE_MAX_OUTSTANDING = 3

const NONCE_MIN_LEN = 16
const NONCE_MAX_LEN = 128
const NONCE_PATTERN = /^[A-Za-z0-9_-]+$/

export interface BootstrapNonce {
  nonce: string
  cData: string
}

/** Nonce opaco (base64url). Non derivabile da input del client. */
export function newBootstrapNonce(): string {
  return randomBytes(32).toString('base64url')
}

/** Cap (env-overridable) dei nonce in sospeso per bucket IP. */
export function bootstrapNonceMaxOutstanding(): number {
  const raw = Number(process.env.BOOTSTRAP_NONCE_MAX_OUTSTANDING)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : BOOTSTRAP_NONCE_MAX_OUTSTANDING
}

/**
 * Crea e persiste un nonce monouso con TTL, legato al bucket IP (`ip_hmac`).
 * Fail-closed: `null` su errore DB (nessuna identità creabile senza nonce).
 */
export async function createBootstrapNonce(
  admin: Admin,
  ipHash?: string | null,
): Promise<BootstrapNonce | null> {
  const nonce = newBootstrapNonce()
  const expiresAt = new Date(Date.now() + BOOTSTRAP_NONCE_TTL_MS).toISOString()

  const { error } = await admin.from('bootstrap_nonces').insert({
    nonce,
    purpose: 'bootstrap',
    expires_at: expiresAt,
    ip_hmac: ipHash ?? null,
  })
  if (error) return null

  return { nonce, cData: `${BOOTSTRAP_CDATA_PREFIX}${nonce}` }
}

/**
 * Conta i nonce non consumati e non scaduti per lo stesso bucket IP.
 * `null` su errore DB (fail-closed: il chiamante risponde 503).
 */
export async function countOutstandingBootstrapNonces(
  admin: Admin,
  ipHash: string,
): Promise<number | null> {
  const now = new Date().toISOString()
  const { count, error } = await admin
    .from('bootstrap_nonces')
    .select('nonce', { count: 'exact', head: true })
    .eq('ip_hmac', ipHash)
    .is('consumed_at', null)
    .gt('expires_at', now)

  if (error) return null
  return count ?? 0
}

/**
 * Estrae il nonce da un `cData` nel formato `bootstrap:<nonce>`.
 * `null` se il formato è assente o non valido (nessun parse permissivo).
 */
export function verifyBootstrapCData(cData: unknown): string | null {
  if (typeof cData !== 'string') return null
  if (!cData.startsWith(BOOTSTRAP_CDATA_PREFIX)) return null
  const nonce = cData.slice(BOOTSTRAP_CDATA_PREFIX.length)
  if (nonce.length < NONCE_MIN_LEN || nonce.length > NONCE_MAX_LEN) return null
  if (!NONCE_PATTERN.test(nonce)) return null
  return nonce
}

/**
 * Esito della consumazione:
 * - `'consumed'`: la riga esisteva, non scaduta e non consumata → consumata ora;
 * - `'invalid'`: nonce vuoto, assente, scaduto o già consumato (replay);
 * - `'error'`: errore infrastrutturale DB → il chiamante risponde 503.
 */
export type BootstrapNonceConsumeResult = 'consumed' | 'invalid' | 'error'

/**
 * Consuma il nonce in modo atomico e monouso. Distingue l'errore DB dal
 * semplice "non consumato" (replay/scadenza), così il chiamante può mappare
 * `'error'` → 503 e `'invalid'` → 403.
 *
 * Il cleanup per scadenza è best-effort e non blocca la decisione.
 */
export async function consumeBootstrapNonce(
  admin: Admin,
  nonce: string,
): Promise<BootstrapNonceConsumeResult> {
  if (!nonce) return 'invalid'
  const now = new Date().toISOString()

  try {
    await admin.from('bootstrap_nonces').delete().lt('expires_at', now)
  } catch {
    // best-effort: non influenza la consumazione
  }

  const { data, error } = await admin
    .from('bootstrap_nonces')
    .update({ consumed_at: now })
    .eq('nonce', nonce)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('nonce')

  if (error) return 'error'
  return Array.isArray(data) && data.length === 1 ? 'consumed' : 'invalid'
}
