/**
 * Logica pura per la panoramica admin: filtro per batch, aggregazione
 * giornaliera e metriche riassuntive.
 *
 * Le "voti" sono SEMPRE sessioni di voto (`vote_sessions`), non assegnazioni
 * pallet: `daily_stats.vote_count` è per-azienda e sommarlo triplicherebbe il
 * conteggio reale, per questo il grafico/le card derivano da qui.
 */

const ROME_TZ = 'Europe/Rome'
const DAYS_IN_CHART = 30
const ACTIVE_WINDOW_MS = 15 * 60 * 1000

export interface SessionSummaryRow {
  created_at: string
  fingerprint: string
  company1_id: string
  company2_id: string
  company3_id: string
}

export interface DailyStat {
  date: string
  vote_count: number
  unique_voters: number
}

export interface AnalyticsSummary {
  totalVotes: number
  uniqueVoters: number
  todayVotes: number
  yesterdayVotes: number
  activeNow: number
  onlineUsers: number
  dailyStats: DailyStat[]
}

const romeDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ROME_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Chiave giorno `YYYY-MM-DD` nel fuso Europe/Rome (fiera italiana). */
export function romeDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  return romeDateFormatter.format(date)
}

function hasCompanyInBatch(
  session: Pick<SessionSummaryRow, 'company1_id' | 'company2_id' | 'company3_id'>,
  batchIds: Set<string>,
): boolean {
  return (
    batchIds.has(session.company1_id) ||
    batchIds.has(session.company2_id) ||
    batchIds.has(session.company3_id)
  )
}

/**
 * Tiene solo le sessioni che toccano almeno una company del batch.
 * `batch` vuoto/null/'all' → nessun filtro (tutti i batch).
 */
export function filterSessionsByBatch<T extends SessionSummaryRow>(
  sessions: T[],
  batch: string | null | undefined,
  batchCompanyIds: Set<string>,
): T[] {
  if (!batch || batch === 'all') return sessions
  return sessions.filter((s) => hasCompanyInBatch(s, batchCompanyIds))
}

/**
 * Costruisce le serie degli ultimi `DAYS_IN_CHART` giorni (dal più vecchio al
 * più recente, zeri inclusi) e le metriche riassuntive.
 */
export function aggregateSummary(
  sessions: SessionSummaryRow[],
  onlineUsers: number,
  now: Date = new Date(),
): AnalyticsSummary {
  const todayKey = romeDateKey(now)
  const yesterdayKey = romeDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const activeThreshold = now.getTime() - ACTIVE_WINDOW_MS

  const uniqueFingerprints = new Set<string>()
  const perDay = new Map<string, { votes: number; voters: Set<string> }>()

  let totalVotes = 0
  let todayVotes = 0
  let yesterdayVotes = 0
  let activeNow = 0

  for (const s of sessions) {
    totalVotes += 1
    uniqueFingerprints.add(s.fingerprint)

    const created = new Date(s.created_at)
    const key = romeDateKey(created)
    if (key === todayKey) todayVotes += 1
    if (key === yesterdayKey) yesterdayVotes += 1
    if (created.getTime() >= activeThreshold) activeNow += 1

    if (key) {
      let bucket = perDay.get(key)
      if (!bucket) {
        bucket = { votes: 0, voters: new Set() }
        perDay.set(key, bucket)
      }
      bucket.votes += 1
      bucket.voters.add(s.fingerprint)
    }
  }

  const dailyStats: DailyStat[] = []
  for (let i = DAYS_IN_CHART - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = romeDateKey(day)
    const bucket = perDay.get(key)
    dailyStats.push({
      date: key,
      vote_count: bucket?.votes ?? 0,
      unique_voters: bucket?.voters.size ?? 0,
    })
  }

  return {
    totalVotes,
    uniqueVoters: uniqueFingerprints.size,
    todayVotes,
    yesterdayVotes,
    activeNow,
    onlineUsers,
    dailyStats,
  }
}

/**
 * Neutralizza la CSV injection: se un valore inizia con un carattere
 * interpretato come formula da Excel/Sheets, lo prefissa con apice.
 */
export function sanitizeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
}
