/**
 * Logica pura per la superficie di sicurezza admin.
 *
 * Nessun accesso a rete/DB: il route handler aggrega i dati e delega qui
 * classificazione e sintesi, così da poter testare le regole in isolamento.
 */

export interface TotalsDriftInput {
  totalsSum: number
  acceptedSum: number
}

export interface TotalsDrift {
  drift: number
  aligned: boolean
}

/** Drift tra somma `company_totals.total_pallets` e pallet dei voti accepted. */
export function computeTotalsDrift({
  totalsSum,
  acceptedSum,
}: TotalsDriftInput): TotalsDrift {
  const drift = totalsSum - acceptedSum
  return { drift, aligned: drift === 0 }
}

export interface NoncesInput {
  total: number
  consumed: number
  expired: number
  outstanding: number
}

export interface NoncesSummary extends NoncesInput {
  suspiciousOutstanding: boolean
}

const OUTSTANDING_ABS_THRESHOLD = 50
const OUTSTANDING_RATIO_THRESHOLD = 0.5
const OUTSTANDING_RATIO_MIN_TOTAL = 20

/**
 * Sintesi dei nonce di bootstrap. `outstanding` è sospetto se supera la soglia
 * assoluta oppure se, con un campione sufficiente (total ≥ 20), incide per più
 * della metà dei nonce totali.
 */
export function summarizeNonces({
  total,
  consumed,
  expired,
  outstanding,
}: NoncesInput): NoncesSummary {
  const suspiciousOutstanding =
    outstanding > OUTSTANDING_ABS_THRESHOLD ||
    (total >= OUTSTANDING_RATIO_MIN_TOTAL &&
      outstanding / total > OUTSTANDING_RATIO_THRESHOLD)
  return { total, consumed, expired, outstanding, suspiciousOutstanding }
}

export type VoteHealthKind = 'json' | 'html' | 'other'

export interface VoteHealthInput {
  status: number
  contentType: string | null | undefined
}

export interface VoteHealth {
  ok: boolean
  kind: VoteHealthKind
}

/**
 * Classifica la salute di `/api/vota` dal `content-type` e dallo status della
 * risposta: una risposta JSON con status < 500 è considerata sana (l'endpoint
 * gira). JSON con status ≥ 500, status assente/0, HTML o altro content-type
 * indicano un endpoint non sano (errore server, redirect a coming-soon/errore).
 */
export function classifyVoteHealth({ status, contentType }: VoteHealthInput): VoteHealth {
  const normalized = (contentType ?? '').toLowerCase()
  if (normalized.startsWith('application/json')) {
    const ok = Number.isFinite(status) && status > 0 && status < 500
    return { ok, kind: 'json' }
  }
  if (normalized.includes('text/html')) return { ok: false, kind: 'html' }
  return { ok: false, kind: 'other' }
}
