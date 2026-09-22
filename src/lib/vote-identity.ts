/**
 * Identità di voto ordinaria: UUID v4 casuale per browser.
 *
 * Sostituisce il `FingerprintJS.visitorId` come chiave di dedup giornaliera:
 * il fingerprint open source collide tra device uniformi (soprattutto iOS /
 * WebView in-app), bloccando visitatori diversi con «Hai già votato oggi».
 *
 * La chiave salvata nella colonna `vote_sessions.fingerprint` è versionata
 * (`v1:<uuid>`), così eventuali formati futuri restano distinguibili. Il
 * fingerprint NON entra nella chiave: un suo drift (update browser/OS)
 * produrrebbe una nuova identità nello stesso giorno.
 */

export const VOTER_COOKIE = 'fantacer_voter_id'
export const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 anno
export const VOTER_KEY_PREFIX = 'v1:'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True solo per UUID v4 in formato canonico (i valori legacy non passano). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Chiave versionata salvata nel DB a partire dall'UUID. */
export function buildVoterKey(uuid: string): string {
  return VOTER_KEY_PREFIX + uuid.toLowerCase()
}

/** Estrae l'UUID da una chiave versionata; null se non è una chiave v1 valida. */
export function parseVoterKey(key: string | null | undefined): string | null {
  if (typeof key !== 'string' || !key.startsWith(VOTER_KEY_PREFIX)) return null
  const uuid = key.slice(VOTER_KEY_PREFIX.length)
  return isUuid(uuid) ? uuid.toLowerCase() : null
}

export function voterCookieOptions() {
  return {
    path: '/',
    maxAge: VOTER_COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}
