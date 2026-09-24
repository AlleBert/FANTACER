'use client'

import { VOTER_COOKIE, VOTER_COOKIE_MAX_AGE, isUuid } from './vote-identity'
import { getStoredVoterId, setStoredVoterId } from './vote-persistence'

/**
 * Inizializzazione dell'identità di voto (UUID v4) condivisa tra cookie
 * first-party e localStorage.
 *
 * Regola di precedenza in lettura: cookie > localStorage. Se uno dei due è un
 * UUID valido e l'altro è assente (o legacy non-UUID) l'identità esistente
 * viene recuperata e riscritta su entrambi, invece di generarne una nuova.
 *
 * Concorrenza: due schede dello stesso browser che partono senza alcuna
 * identità vengono serializzate con la Web Locks API e la perdente rilegge il
 * valore scritto dalla vincente → stessa identità. Senza Web Locks si applica
 * un fallback best-effort (write + rilettura).
 */

const LOCK_NAME = 'fantacer-voter-id'

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>
}

function getLockManager(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks
  return locks && typeof locks.request === 'function' ? locks : null
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  try {
    const entry = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
    if (!entry) return null
    return decodeURIComponent(entry.slice(name.length + 1))
  } catch {
    return null
  }
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${VOTER_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
  } catch {
    // cookie non disponibili: il localStorage resta la copia di riferimento
  }
}

function randomUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * F0 — Bridge identità legacy: localStorage → cookie first-party.
 *
 * Chi ha l'UUID **solo** in `localStorage` (cookie assente: deploy nuovo,
 * cookie cancellati, Safari ITP) deve ritrovare la stessa identità lato
 * server. Il bootstrap legge il fingerprint dal **solo cookie** first-party
 * `fantacer_voter_id`: scrivere il cookie qui, prima di ogni bootstrap, evita
 * che quel browser venga agganciato a un nuovo principal (→ secondo voto).
 *
 * Regole (precedenza cookie > localStorage):
 * - cookie UUID valido → nessuna scrittura;
 * - cookie assente/non valido + localStorage UUID valido → scrive il cookie;
 * - localStorage assente o legacy → nessuna scrittura.
 *
 * Sincrona, SSR-safe, best-effort. Non crea nuove superfici di persistenza:
 * scrive solo il cookie first-party già usato altrove. Ritorna l'UUID
 * effettivo (cookie o bridged) oppure `null`.
 */
export function bridgeLegacyIdentityToCookie(): string | null {
  const cookie = readCookie(VOTER_COOKIE)
  if (isUuid(cookie)) return cookie.toLowerCase()
  const stored = getStoredVoterId()
  if (!isUuid(stored)) return null
  const id = stored.toLowerCase()
  writeCookie(VOTER_COOKIE, id)
  return id
}

/** UUID esistente (cookie > localStorage) oppure null. I valori legacy sono ignorati. */
function resolveFromStorage(): string | null {
  return bridgeLegacyIdentityToCookie()
}

function persist(id: string): void {
  setStoredVoterId(id)
  writeCookie(VOTER_COOKIE, id)
}

/**
 * Versione non memoizzata, esportata per i test. Ritorna anche `isNew` per
 * permettere al ripristino stato di saltare la chiamata quando l'identità è
 * appena stata generata (non può avere voti precedenti).
 */
export async function initializeVoterIdentity(): Promise<{ voterId: string; isNew: boolean }> {
  const existing = resolveFromStorage()
  if (existing) {
    persist(existing)
    return { voterId: existing, isNew: false }
  }

  const lock = getLockManager()
  if (lock) {
    return lock.request(LOCK_NAME, () => {
      const afterLock = resolveFromStorage()
      if (afterLock) {
        persist(afterLock)
        return { voterId: afterLock, isNew: false }
      }
      const created = randomUuid()
      persist(created)
      return { voterId: created, isNew: true }
    })
  }

  // Fallback best-effort senza Web Locks: scrivi poi rileggi; se un'altra
  // scheda ha vinto la corsa, adotta la sua identità.
  const created = randomUuid()
  persist(created)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const winner = resolveFromStorage()
  if (winner && winner !== created) {
    persist(winner)
    return { voterId: winner, isNew: false }
  }
  return { voterId: created, isNew: true }
}

let memo: Promise<{ voterId: string; isNew: boolean }> | null = null
let newIdentity = false

/** Identità stabile per la pagina. Stesso promise a ogni chiamata. */
export function ensureVoterId(): Promise<string> {
  if (!memo) {
    const promise = initializeVoterIdentity().then((result) => {
      newIdentity = result.isNew
      return result
    })
    promise.catch(() => {
      if (memo === promise) memo = null
    })
    memo = promise
  }
  return memo.then((result) => result.voterId)
}

/** True se l'identità corrente è stata generata in questa pagina (nessun voto precedente). */
export function isNewVoterIdentity(): boolean {
  return newIdentity
}

/** Solo per i test: azzera la memoizzazione. */
export function __resetVoterIdentityForTests(): void {
  memo = null
  newIdentity = false
}
