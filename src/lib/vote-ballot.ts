import { createHash } from 'node:crypto'

/**
 * C09 — Canonicalizzazione della scheda di voto per `ballot_hash`.
 *
 * Deve produrre **esattamente** lo stesso hash del lato SQL
 * (`public.submit_vote_v2`, migration `20260927000000_submit_vote_v2.sql`):
 *
 *   payload = 'v1|' || join('|', entries.sort(by company_id).map(e => `${id}:${pallet}`))
 *   hash    = 'v1:' || sha256hex(payload)
 *
 * Proprietà garantite:
 * - **Order-independent**: l'ordine di arrivo delle 3 scelte non cambia l'hash.
 * - **Versionata**: il prefisso `v1` (nel payload e nell'hash) congela lo schema.
 * - **Deterministica**: stesse coppie (companyId, pallet) → stesso hash.
 *
 * I `companyId` sono normalizzati a lowercase (equivalente al cast `::uuid` di
 * Postgres). L'ordinamento usa il confronto per code-unit, che per UUID canonici
 * lowercase coincide con l'ordine byte-wise di Postgres.
 */

export const BALLOT_HASH_VERSION = 'v1'

export type BallotPallet = 1 | 2 | 4

export interface BallotEntry {
  companyId: string
  pallet: BallotPallet
}

export interface CanonicalBallotEntry {
  companyId: string
  pallet: BallotPallet
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valida e ordina le 3 coppie (companyId, pallet) in modo canonico.
 * Lancia con messaggi generici (nessuna PII) se la scheda non è valida.
 */
export function canonicalizeBallot(
  ballot: readonly BallotEntry[],
): CanonicalBallotEntry[] {
  if (!Array.isArray(ballot) || ballot.length !== 3) {
    throw new Error('ballot: attesi esattamente 3 elementi')
  }

  const seenCompanies = new Set<string>()
  const normalized = ballot.map((entry) => {
    if (!entry || typeof entry.companyId !== 'string' || !UUID_RE.test(entry.companyId)) {
      throw new Error('ballot: companyId non valido')
    }
    const companyId = entry.companyId.toLowerCase()
    if (entry.pallet !== 1 && entry.pallet !== 2 && entry.pallet !== 4) {
      throw new Error('ballot: pallet non valido')
    }
    if (seenCompanies.has(companyId)) {
      throw new Error('ballot: aziende duplicate')
    }
    seenCompanies.add(companyId)
    return { companyId, pallet: entry.pallet }
  })

  if (new Set(normalized.map((e) => e.pallet)).size !== 3) {
    throw new Error('ballot: pallet duplicati')
  }

  return normalized.sort((a, b) =>
    a.companyId < b.companyId ? -1 : a.companyId > b.companyId ? 1 : 0,
  )
}

/** Payload canonico versionato (input di sha256). Specchia `v_canonical` in SQL. */
export function canonicalBallotPayload(ballot: readonly BallotEntry[]): string {
  const entries = canonicalizeBallot(ballot)
  return `${BALLOT_HASH_VERSION}|` + entries.map((e) => `${e.companyId}:${e.pallet}`).join('|')
}

/** `ballot_hash` canonico versionato, identico al valore calcolato dalla RPC SQL. */
export function ballotHash(ballot: readonly BallotEntry[]): string {
  const digest = createHash('sha256')
    .update(canonicalBallotPayload(ballot), 'utf8')
    .digest('hex')
  return `${BALLOT_HASH_VERSION}:${digest}`
}
