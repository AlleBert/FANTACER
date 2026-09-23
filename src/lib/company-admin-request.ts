import type { CompanyAction } from './company-admin-projection'

export type ParsedCompanyAction =
  | { ok: true; action: CompanyAction }
  | { ok: false; error: string }

/**
 * Normalizza il body HTTP in una `CompanyAction`.
 *
 * `score`: assente/invalid → undefined (non toccare); `null` → rimuovi override;
 * `{ pallets, votes }` numerici → imposta.
 */
export function parseCompanyAction(body: unknown): ParsedCompanyAction {
  const b = (body ?? {}) as Record<string, unknown>
  const companyIds = b.companyIds

  if (
    !Array.isArray(companyIds) ||
    companyIds.length === 0 ||
    companyIds.some((id) => typeof id !== 'string')
  ) {
    return { ok: false, error: 'companyIds obbligatorio' }
  }

  const scoreRaw = b.score
  let score: CompanyAction['score']
  if (scoreRaw === null) {
    score = null
  } else if (scoreRaw && typeof scoreRaw === 'object') {
    const s = scoreRaw as Record<string, unknown>
    if (Number.isFinite(s.pallets) && Number.isFinite(s.votes)) {
      score = { pallets: Number(s.pallets), votes: Number(s.votes) }
    }
  }

  return {
    ok: true,
    action: {
      companyIds: companyIds as string[],
      deleteVotes: b.deleteVotes === true,
      blocked: typeof b.blocked === 'boolean' ? b.blocked : undefined,
      score,
    },
  }
}
