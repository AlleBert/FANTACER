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
 * Precedenza: cookie first-party > `voterId` nel payload. Il payload copre il
 * caso di cookie non ancora persistito (prima richiesta / cookie disabilitati);
 * una volta impostato, il cookie è l'autorità condivisa da tutte le schede.
 *
 * Ritorna `null` quando non esiste un UUID valido: niente fallback al
 * FingerprintJS, che non risolve le collisioni.
 */
export function resolveVoterKey(
  request: VoterCookieSource,
  bodyVoterId: unknown,
): ResolvedVoter | null {
  const cookieValue = request.cookies.get(VOTER_COOKIE)?.value
  const candidate = isUuid(cookieValue) ? cookieValue : isUuid(bodyVoterId) ? bodyVoterId : null
  if (!candidate) return null
  const voterId = candidate.toLowerCase()
  return { key: buildVoterKey(voterId), voterId }
}

/** Imposta/rinfresca il cookie identità sulla risposta. */
export function applyVoterCookie(response: NextResponse, voterId: string): void {
  response.cookies.set(VOTER_COOKIE, voterId, voterCookieOptions())
}
