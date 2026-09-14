'use client'

const STORAGE_KEY = 'fantacer_voter_id'

/**
 * Persiste solo l'identità del votante (visitorId FingerprintJS) per potersi
 * riconoscere al reload. Nessun dato di voto è salvato lato client: la fonte di
 * verità resta il DB, interrogato da `/api/vota/status`.
 */

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // storage non disponibile: nessuna persistenza, il server resta comunque autoritativo
  }
}

function remove(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // storage non disponibile: nulla da pulire
  }
}

export function getStoredVoterId(): string | null {
  return read(STORAGE_KEY)
}

export function setStoredVoterId(visitorId: string): void {
  if (!visitorId) return
  write(STORAGE_KEY, visitorId)
}

export function clearStoredVoterId(): void {
  remove(STORAGE_KEY)
}
