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
 */

type Admin = ReturnType<typeof createAdminClient>

export const BOOTSTRAP_NONCE_TTL_MS = 120_000
export const BOOTSTRAP_CDATA_PREFIX = 'bootstrap:'

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

/**
 * Crea e persiste un nonce monouso con TTL. Fail-closed: `null` su errore DB
 * (nessuna identità creabile senza nonce).
 */
export async function createBootstrapNonce(admin: Admin): Promise<BootstrapNonce | null> {
  const nonce = newBootstrapNonce()
  const expiresAt = new Date(Date.now() + BOOTSTRAP_NONCE_TTL_MS).toISOString()

  const { error } = await admin.from('bootstrap_nonces').insert({
    nonce,
    purpose: 'bootstrap',
    expires_at: expiresAt,
  })
  if (error) return null

  return { nonce, cData: `${BOOTSTRAP_CDATA_PREFIX}${nonce}` }
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
 * Consuma il nonce in modo atomico e monouso. `true` solo se la riga esiste,
 * non è scaduta e non era già consumata. Fail-closed: `false` su errore DB.
 *
 * Il cleanup per scadenza è best-effort e non blocca la decisione.
 */
export async function consumeBootstrapNonce(admin: Admin, nonce: string): Promise<boolean> {
  if (!nonce) return false
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

  if (error) return false
  return Array.isArray(data) && data.length === 1
}
