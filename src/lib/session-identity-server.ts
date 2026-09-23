import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveBatch } from '@/lib/supabase/batch'
import {
  hashToken,
  formatSessionCookie,
  parseSessionCookie,
  generateToken,
  SESSION_HASH_VERSION,
  SESSION_COOKIE_MAX_AGE,
  type SessionKeyring,
} from '@/lib/session-identity'

/**
 * P0-4 — Identità server-side (lato server).
 *
 * Modalità `SESSION_IDENTITY_MODE`:
 * - `off` (default): nessun effetto, comportamento legacy.
 * - `shadow`: dual-write (scrive principal senza cambiare la lettura).
 * - `dual`: dual-read (sessione → fallback legacy) + dual-write.
 * - `session`: cutover (lettura solo sessione).
 *
 * Fail-closed: su errore infrastrutturale si ritorna null/503, mai una nuova
 * identità implicita.
 */

export type SessionIdentityMode = 'off' | 'shadow' | 'dual' | 'session'

export function sessionIdentityMode(): SessionIdentityMode {
  const v = process.env.SESSION_IDENTITY_MODE
  return v === 'shadow' || v === 'dual' || v === 'session' ? v : 'off'
}

type Admin = ReturnType<typeof createAdminClient>

export interface ActiveEvent {
  id: string
  batch: string
}

/** Evento attivo: `active_event_id` se valorizzato, altrimenti `events.batch = active_batch`. */
export async function getActiveEvent(admin: Admin): Promise<ActiveEvent | null> {
  const { data: bs } = await admin
    .from('batch_settings')
    .select('active_batch, active_event_id')
    .eq('id', 'default')
    .maybeSingle()

  if (bs?.active_event_id) {
    const { data: ev } = await admin
      .from('events')
      .select('id, batch')
      .eq('id', bs.active_event_id)
      .maybeSingle()
    if (ev) return { id: ev.id, batch: ev.batch }
  }

  const activeBatch = bs?.active_batch ?? (await getActiveBatch())
  if (!activeBatch) return null

  const { data: ev } = await admin
    .from('events')
    .select('id, batch')
    .eq('batch', activeBatch)
    .eq('status', 'active')
    .maybeSingle()
  return ev ? { id: ev.id, batch: ev.batch } : null
}

/** Trova o crea il principal per (`event_id`, `legacy_fingerprint`). Idempotente. */
export async function resolveOrCreatePrincipal(
  admin: Admin,
  eventId: string,
  legacyFingerprint: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('event_principals')
    .select('id')
    .eq('event_id', eventId)
    .eq('legacy_fingerprint', legacyFingerprint)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: created, error } = await admin
    .from('event_principals')
    .insert({ event_id: eventId, legacy_fingerprint: legacyFingerprint })
    .select('id')
    .single()
  if (!error && created?.id) return created.id

  // Race: un'altra richiesta l'ha creato nel frattempo.
  const { data: again } = await admin
    .from('event_principals')
    .select('id')
    .eq('event_id', eventId)
    .eq('legacy_fingerprint', legacyFingerprint)
    .maybeSingle()
  return again?.id ?? null
}

export interface IssuedSession {
  cookieValue: string
  principalId: string
  expiresAt: string
}

export async function createSession(
  admin: Admin,
  eventId: string,
  principalId: string,
  keyring: SessionKeyring,
  ttlMs = SESSION_COOKIE_MAX_AGE * 1000,
): Promise<IssuedSession | null> {
  const token = generateToken()
  const tokenHash = hashToken(keyring.active, token, keyring)
  if (!tokenHash) return null
  const expiresAt = new Date(Date.now() + ttlMs).toISOString()

  const { error } = await admin.from('voter_sessions').insert({
    event_id: eventId,
    principal_id: principalId,
    token_hash: tokenHash,
    key_id: keyring.active,
    hash_version: SESSION_HASH_VERSION,
    expires_at: expiresAt,
  })
  if (error) return null

  return {
    cookieValue: formatSessionCookie(keyring.active, token),
    principalId,
    expiresAt,
  }
}

/** Risolve il principal da un cookie di sessione; null se assente/scaduto/revocato. */
export async function resolveSessionPrincipal(
  admin: Admin,
  cookieValue: string | null | undefined,
  keyring: SessionKeyring,
): Promise<string | null> {
  const parsed = parseSessionCookie(cookieValue)
  if (!parsed) return null
  const tokenHash = hashToken(parsed.keyId, parsed.token, keyring)
  if (!tokenHash) return null

  const { data } = await admin
    .from('voter_sessions')
    .select('id, principal_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!data || data.revoked_at) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  // touch best-effort: non blocca né fallisce la richiesta.
  void admin
    .from('voter_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(
      () => {},
      () => {},
    )

  return data.principal_id
}

/** Dual-write shadow: valorizza event_id/principal_id sulla riga appena inserita. */
export async function linkVoteToPrincipal(
  admin: Admin,
  fingerprint: string,
  voteDay: string,
  eventId: string,
  principalId: string,
): Promise<void> {
  await admin
    .from('vote_sessions')
    .update({ event_id: eventId, principal_id: principalId })
    .eq('fingerprint', fingerprint)
    .eq('vote_day', voteDay)
}
