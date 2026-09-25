import type { NextResponse } from 'next/server'
import { VOTER_COOKIE, buildVoterKey, isUuid, voterCookieOptions } from './vote-identity'

export interface ResolvedVoter {
  /** Chiave versionata salvata in `vote_sessions.fingerprint` (`v1:<uuid>`). */
  key: string
  /** UUID da restituire al client e da riscrivere nel cookie. */
  voterId: string
}

/** Sorgente cookie minima (NextRequest la soddisfa strutturalmente). */
export interface VoterCookieSource {
  cookies: {
    get(name: string): { value: string } | undefined
  }
}

/**
 * Resolver unico per `/api/vota` e `/api/vota/status`.
 *
 * **C08** — l'identità arriva **solo** dal cookie first-party
 * `fantacer_voter_id`: `voterId` è rimosso dal contratto e non è mai letto dal
 * payload (il parametro non esiste proprio, per impedirlo a livello di tipo).
 *
 * Ritorna `null` quando il cookie non è un UUID valido: niente fallback al
 * FingerprintJS (collisioni) né a un UUID nuovo per richiesta.
 */
export function resolveVoterKey(request: VoterCookieSource): ResolvedVoter | null {
  const cookieValue = request.cookies.get(VOTER_COOKIE)?.value
  if (!isUuid(cookieValue)) return null
  const voterId = cookieValue.toLowerCase()
  return { key: buildVoterKey(voterId), voterId }
}

/** Imposta/rinfresca il cookie identità sulla risposta. */
export function applyVoterCookie(response: NextResponse, voterId: string): void {
  response.cookies.set(VOTER_COOKIE, voterId, voterCookieOptions())
}
