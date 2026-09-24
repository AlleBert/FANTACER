/**
 * Telemetria del percorso voto — un unico marker privacy-safe.
 *
 * `vote_request_end` è una riga JSON con SOLO campi aggregabili:
 * esito, status, durata, mode/scope del rate limit e segnale IP (source/
 * confidence/presenza). **Mai** IP, UUID, token, cookie o contenuto del voto.
 */

export type VoteOutcome =
  | 'success'
  | 'already_voted'
  | 'turnstile_failed'
  | 'missing_security'
  | 'rate_limited'
  | 'antibot'
  | 'fair_ended'
  | 'invalid_request'
  | 'csrf_failed'
  | 'no_session'
  | 'renew_required'
  | 'quarantined'
  | 'error'

/** Modalità identità al momento della richiesta (nessun dato personale). */
export type VoteIdentityMode = 'off' | 'shadow' | 'dual' | 'session'

export interface VoteRequestEndEvent {
  outcome: VoteOutcome
  status: number
  ms: number
  identityMode?: VoteIdentityMode
  riskDecision?: 'accept' | 'stepup' | 'quarantine'
  rateMode?: 'observe' | 'enforce'
  rateWouldBlock?: boolean
  rateIpWouldBlock?: boolean
  rateIdWouldBlock?: boolean
  rateScopes?: { ip: boolean | null; id: boolean | null }
  ipSource?: string
  ipConfidence?: string
  ipHasDetected?: boolean
  turnstileReason?: string | null
}

export const VOTE_REQUEST_END_MARKER = 'vote_request_end'

/** Serializza in una singola riga JSON. Nessun valore identificativo. */
export function serializeVoteRequestEnd(e: VoteRequestEndEvent): string {
  return JSON.stringify({
    marker: VOTE_REQUEST_END_MARKER,
    level: 'info',
    outcome: e.outcome,
    status: e.status,
    ms: e.ms,
    identityMode: e.identityMode ?? null,
    riskDecision: e.riskDecision ?? null,
    rateMode: e.rateMode ?? null,
    rateWouldBlock: e.rateWouldBlock ?? null,
    rateIpWouldBlock: e.rateIpWouldBlock ?? null,
    rateIdWouldBlock: e.rateIdWouldBlock ?? null,
    rateScopes: e.rateScopes ?? null,
    ipSource: e.ipSource ?? null,
    ipConfidence: e.ipConfidence ?? null,
    ipHasDetected: e.ipHasDetected ?? null,
    turnstileReason: e.turnstileReason ?? null,
  })
}

/** Emesso a livello `info` (console.log): l'aggregatore legge i log info. */
export function logVoteRequestEnd(e: VoteRequestEndEvent): void {
  console.log(serializeVoteRequestEnd(e))
}
