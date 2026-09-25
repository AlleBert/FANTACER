import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * P0-4 — Identità server-side: cookie di sessione e keyring HMAC.
 *
 * Il token è opaco (`key_id.token`), il server salva solo `token_hash`.
 * Keyring versionato: `SESSION_HMAC_KEYS=k1:<b64>,k2:<b64>` + `SESSION_HMAC_ACTIVE=k2`.
 * Nessun IP/UUID/token nei log.
 */

export const SESSION_COOKIE = 'fantacer_session'
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 12
export const SESSION_HASH_VERSION = 1
export const MIN_KEY_BYTES = 32

/** Finestra idle: oltre questo intervallo senza attività la sessione è invalida. */
export const SESSION_IDLE_MS = 60 * 60 * 2
/** Vita assoluta: cap invalicabile dall'ultimo rinnovo. */
export const SESSION_ABSOLUTE_MS = SESSION_COOKIE_MAX_AGE * 1000

export interface SessionKeyring {
  active: string
  keys: Map<string, Buffer>
}

export function parseKeyring(
  env: string | undefined,
  active: string | undefined,
): SessionKeyring | null {
  if (!env || !active) return null
  const keys = new Map<string, Buffer>()
  for (const part of env.split(',')) {
    const [id, b64] = part.split(':')
    if (!id || !b64) continue
    const key = Buffer.from(b64, 'base64')
    if (key.length < MIN_KEY_BYTES) continue
    keys.set(id, key)
  }
  if (!keys.has(active)) return null
  return { active, keys }
}

export function keyringFromEnv(): SessionKeyring | null {
  return parseKeyring(process.env.SESSION_HMAC_KEYS, process.env.SESSION_HMAC_ACTIVE)
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(keyId: string, token: string, keyring: SessionKeyring): string | null {
  const key = keyring.keys.get(keyId)
  if (!key) return null
  return createHmac('sha256', key).update(`${keyId}|${token}`).digest('hex')
}

export function formatSessionCookie(keyId: string, token: string): string {
  return `${keyId}.${token}`
}

export function parseSessionCookie(
  value: string | null | undefined,
): { keyId: string; token: string } | null {
  if (!value) return null
  const i = value.indexOf('.')
  if (i <= 0 || i === value.length - 1) return null
  return { keyId: value.slice(0, i), token: value.slice(i + 1) }
}

export function verifyToken(
  keyId: string,
  token: string,
  tokenHash: string,
  keyring: SessionKeyring,
): boolean {
  const expected = hashToken(keyId, token, keyring)
  if (!expected) return false
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(tokenHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * CSRF — token separato dal token di sessione, hash HMAC salvato nella riga
 * `voter_sessions.csrf_hash`. Domain separation vs. `hashToken` con namespace
 * esplicito `csrf.v1|`.
 *
 * `keyId` default `keyring.active`. Nota di design: la sessione salva
 * `key_id` ma non un `csrf_key_id` dedicato, quindi la verifica usa la key
 * attiva del momento. Ruotare `SESSION_HMAC_ACTIVE` invalida il CSRF delle
 * sessioni emesse con la key precedente finché non si persiste un
 * `csrf_key_id` (follow-up DB, non introdotto ora). Il param opzionale
 * consente ai chiamanti di legare il CSRF a un key id specifico quando la
 * colonna esisterà.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashCsrfToken(
  csrf: string,
  keyring: SessionKeyring,
  keyId: string = keyring.active,
): string | null {
  const key = keyring.keys.get(keyId)
  if (!key) return null
  return createHmac('sha256', key).update(`csrf.v1|${csrf}`).digest('hex')
}

export function verifyCsrf(
  csrf: string | null | undefined,
  csrfHash: string | null | undefined,
  keyring: SessionKeyring,
  keyId: string = keyring.active,
): boolean {
  if (!csrf || !csrfHash) return false
  const expected = hashCsrfToken(csrf, keyring, keyId)
  if (!expected) return false
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(csrfHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function sessionCookieOptions(maxAge = SESSION_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}
