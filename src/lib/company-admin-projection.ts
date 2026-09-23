/**
 * Proiezione pura delle azioni admin sulle aziende.
 *
 * Calcola classifica "prima" e "dopo" senza toccare il DB, così la preview è
 * deterministica e testabile. Semantica override: `base + (live - snapshot)`,
 * dove `snapshot` è il contatore live al momento dell'impostazione: la classifica
 * mostra esattamente `base`, e i voti successivi si sommano da lì.
 */

export interface CompanyLite {
  id: string
  name: string
  blocked: boolean
}

export interface LiveTotals {
  pallets: number
  votes: number
}

export interface ScoreOverride {
  companyId: string
  basePallets: number
  baseVotes: number
  snapshotPallets: number
  snapshotVotes: number
}

export interface SessionLite {
  company1Id: string
  company2Id: string
  company3Id: string
  pallet1: number
  pallet2: number
  pallet3: number
}

/** `score` assente = non toccare; `null` = rimuovi override; oggetto = imposta. */
export interface CompanyAction {
  companyIds: string[]
  deleteVotes?: boolean
  blocked?: boolean
  score?: { pallets: number; votes: number } | null
}

export interface ProjectionInput {
  companies: CompanyLite[]
  live: Map<string, LiveTotals>
  overrides: Map<string, ScoreOverride>
  sessions: SessionLite[]
  action: CompanyAction
}

export interface RankingRow {
  id: string
  name: string
  pallets: number
  votes: number
  rank: number
}

export interface ProjectionImpact {
  sessionsDeleted: number
  palletsBefore: Record<string, number>
  palletsAfter: Record<string, number>
  selected: string[]
}

export interface ProjectionResult {
  before: RankingRow[]
  after: RankingRow[]
  impact: ProjectionImpact
}

const touches = (s: SessionLite, id: string) =>
  s.company1Id === id || s.company2Id === id || s.company3Id === id

export function aggregate(sessions: SessionLite[]): Map<string, LiveTotals> {
  const m = new Map<string, LiveTotals>()
  const add = (id: string, p: number) => {
    const cur = m.get(id) ?? { pallets: 0, votes: 0 }
    cur.pallets += p
    cur.votes += 1
    m.set(id, cur)
  }
  for (const s of sessions) {
    add(s.company1Id, s.pallet1)
    add(s.company2Id, s.pallet2)
    add(s.company3Id, s.pallet3)
  }
  return m
}

function displayed(
  live: LiveTotals | undefined,
  override: ScoreOverride | undefined,
): LiveTotals {
  const l = live ?? { pallets: 0, votes: 0 }
  if (!override) return l
  return {
    pallets: override.basePallets + (l.pallets - override.snapshotPallets),
    votes: override.baseVotes + (l.votes - override.snapshotVotes),
  }
}

function rank(
  companies: CompanyLite[],
  live: Map<string, LiveTotals>,
  overrides: Map<string, ScoreOverride>,
  blocked: Map<string, boolean>,
): RankingRow[] {
  return companies
    .filter((c) => !(blocked.get(c.id) ?? c.blocked))
    .map((c) => {
      const d = displayed(live.get(c.id), overrides.get(c.id))
      return { id: c.id, name: c.name, pallets: d.pallets, votes: d.votes, rank: 0 }
    })
    .sort(
      (a, b) =>
        b.pallets - a.pallets || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

export function projectCompanyAction(input: ProjectionInput): ProjectionResult {
  const { companies, live, overrides, sessions, action } = input
  const blocked = new Map(companies.map((c) => [c.id, c.blocked]))

  const before = rank(companies, live, overrides, blocked)
  const palletsBefore = Object.fromEntries(before.map((r) => [r.id, r.pallets]))

  const keptSessions = action.deleteVotes
    ? sessions.filter((s) => !action.companyIds.some((id) => touches(s, id)))
    : sessions
  const sessionsDeleted = action.deleteVotes ? sessions.length - keptSessions.length : 0
  const liveAfter = action.deleteVotes ? aggregate(keptSessions) : live

  const overridesAfter = new Map(overrides)
  if (action.score !== undefined) {
    for (const id of action.companyIds) {
      if (action.score === null) {
        overridesAfter.delete(id)
      } else {
        const l = liveAfter.get(id) ?? { pallets: 0, votes: 0 }
        overridesAfter.set(id, {
          companyId: id,
          basePallets: action.score.pallets,
          baseVotes: action.score.votes,
          snapshotPallets: l.pallets,
          snapshotVotes: l.votes,
        })
      }
    }
  }

  if (action.blocked !== undefined) {
    for (const id of action.companyIds) blocked.set(id, action.blocked)
  }

  const after = rank(companies, liveAfter, overridesAfter, blocked)

  return {
    before,
    after,
    impact: {
      sessionsDeleted,
      palletsBefore,
      palletsAfter: Object.fromEntries(after.map((r) => [r.id, r.pallets])),
      selected: action.companyIds,
    },
  }
}
