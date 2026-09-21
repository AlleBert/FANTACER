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

export interface HourBucket {
  hour: number
  votes: number
}

export interface AnalyticsSummary {
  totalVotes: number
  uniqueVoters: number
  todayVotes: number
  yesterdayVotes: number
  activeNow: number
  onlineUsers: number
  dailyStats: DailyStat[]
  /** Fasce orarie (24 bucket) per giorno `YYYY-MM-DD`; presente solo per i giorni con voti. */
  hourlyByDay: Record<string, HourBucket[]>
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
  const hourlyByDay: Record<string, HourBucket[]> = {}

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

      const hour = romeHourKey(created)
      if (hour >= 0 && hour < 24) {
        let dayHours = hourlyByDay[key]
        if (!dayHours) {
          dayHours = Array.from({ length: 24 }, (_, h) => ({ hour: h, votes: 0 }))
          hourlyByDay[key] = dayHours
        }
        dayHours[hour].votes += 1
      }
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
    hourlyByDay,
  }
}

export interface TrendPoint {
  key: string
  label: string
  votes: number
  cumulative: number
}

/**
 * Serie giornaliera per il grafico "Andamento Votazioni": cumulato calcolato
 * sull'intera serie passata (con `selectDailyRange` il cumulato riparte
 * dall'inizio dell'intervallo) e giorni a zero iniziali/finali rimossi per
 * evitare l'effetto linea schiacciata. Gli zeri interni sono mantenuti.
 */
export function buildVoteTrend(dailyStats: DailyStat[]): TrendPoint[] {
  let running = 0
  const withCumulative: TrendPoint[] = dailyStats.map((day) => {
    running += day.vote_count
    return {
      key: day.date,
      label: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`,
      votes: day.vote_count,
      cumulative: running,
    }
  })

  const first = withCumulative.findIndex((point) => point.votes > 0)
  if (first === -1) return []

  let last = withCumulative.length - 1
  while (last > first && withCumulative[last].votes === 0) last -= 1

  return withCumulative.slice(first, last + 1)
}

/**
 * Filtra la serie giornaliera (zero-filled) all'intervallo `[from, to]`
 * inclusivo, in chiave `YYYY-MM-DD` (Europe/Rome). Un lato vuoto non filtra.
 * Ritorna [] se l'intervallo è invertito.
 */
export function selectDailyRange(dailyStats: DailyStat[], from: string, to: string): DailyStat[] {
  if (from && to && from > to) return []
  return dailyStats.filter((d) => (!from || d.date >= from) && (!to || d.date <= to))
}

/**
 * Serie oraria della giornata corrente: cumulato infragiornaliero e trim a solo
 * ore attive, con un'ora di contesto ai bordi. Usata come fallback quando c'è un
 * solo giorno di dati (per non mostrare un grafico con un unico punto).
 */
export function buildHourlyTrend(buckets: HourBucket[]): TrendPoint[] {
  let running = 0
  const withCumulative: TrendPoint[] = buckets.map((bucket) => {
    running += bucket.votes
    return {
      key: String(bucket.hour),
      label: `${pad2(bucket.hour)}:00`,
      votes: bucket.votes,
      cumulative: running,
    }
  })

  const first = withCumulative.findIndex((point) => point.votes > 0)
  if (first === -1) return []

  let last = withCumulative.length - 1
  while (last > first && withCumulative[last].votes === 0) last -= 1

  const from = Math.max(0, first - 1)
  const to = Math.min(withCumulative.length - 1, last + 1)
  return withCumulative.slice(from, to + 1)
}

/**
 * Neutralizza la CSV injection: se un valore inizia con un carattere
 * interpretato come formula da Excel/Sheets, lo prefissa con apice.
 */
export function sanitizeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
}

// ---------------------------------------------------------------------------
// Riepilogo giornaliero (export marketing)
// ---------------------------------------------------------------------------

export interface ReportSessionRow extends SessionSummaryRow {
  country: string | null
  pallet1: number
  pallet2: number
  pallet3: number
}

export interface ReportCompany {
  id: string
  name: string
  points: number
  votes: number
  firsts: number
  seconds: number
  thirds: number
}

export interface ReportHour {
  hour: number
  votes: number
}

export interface ReportDay {
  date: string
  votes: number
  uniqueVoters: number
  points: number
}

export interface DailyReport {
  dayKey: string
  dayLabel: string
  generatedAt: string
  votes: number
  uniqueVoters: number
  totalPoints: number
  avgVotesPerHour: number
  activeHours: number
  firstVoteAt: string | null
  lastVoteAt: string | null
  hourly: ReportHour[]
  peakHour: number | null
  quietHour: number | null
  countries: { country: string; votes: number }[]
  companies: ReportCompany[]
  top3: ReportCompany[]
  yesterday: { votes: number; uniqueVoters: number }
  week: { days: ReportDay[]; votes: number; uniqueVoters: number; totalPoints: number }
}

const romeHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ROME_TZ,
  hour: '2-digit',
  hourCycle: 'h23',
})

const romeDayLabelFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: ROME_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const romeTimeFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: ROME_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Ora del giorno (0–23) nel fuso Europe/Rome; -1 su data invalida. */
export function romeHourKey(date: Date): number {
  if (Number.isNaN(date.getTime())) return -1
  return Number(romeHourFormatter.format(date))
}

function utcNoonFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Lunedì della settimana ISO che contiene `key` (YYYY-MM-DD, Europe/Rome). */
function mondayKeyOf(key: string): string {
  const date = utcNoonFromKey(key)
  const dow = (date.getUTCDay() + 6) % 7
  return romeDateKey(addDays(date, -dow))
}

function addCompany(
  map: Map<string, ReportCompany>,
  names: Map<string, string>,
  id: string,
  points: number,
  position: 'firsts' | 'seconds' | 'thirds',
): void {
  let entry = map.get(id)
  if (!entry) {
    entry = {
      id,
      name: names.get(id) ?? id,
      points: 0,
      votes: 0,
      firsts: 0,
      seconds: 0,
      thirds: 0,
    }
    map.set(id, entry)
  }
  entry.points += points
  entry.votes += 1
  entry[position] += 1
}

/**
 * Costruisce il riepilogo della giornata corrente (Europe/Rome) più il
 * cumulato della settimana ISO. Puro: nessun accesso a DB o `Date.now()`
 * implicito (`now` iniettabile), così è testabile.
 */
export function buildDailyReport(
  sessions: ReportSessionRow[],
  companyNames: Map<string, string>,
  now: Date = new Date(),
): DailyReport {
  const dayKey = romeDateKey(now)
  const yesterdayKey = romeDateKey(new Date(now.getTime() - 86_400_000))
  const weekKeys: string[] = []
  const monday = utcNoonFromKey(mondayKeyOf(dayKey))
  for (let i = 0; i < 7; i += 1) weekKeys.push(romeDateKey(addDays(monday, i)))

  const hourly: ReportHour[] = Array.from({ length: 24 }, (_, hour) => ({ hour, votes: 0 }))
  const countriesMap = new Map<string, number>()
  const companiesMap = new Map<string, ReportCompany>()
  const dayVoters = new Set<string>()
  const yesterdayVoters = new Set<string>()
  const weekVoters = new Set<string>()
  const weekDayMap = new Map<string, { votes: number; voters: Set<string>; points: number }>()

  let votes = 0
  let totalPoints = 0
  let firstVoteAt: string | null = null
  let lastVoteAt: string | null = null
  let yesterdayVotes = 0
  let weekVotes = 0
  let weekPoints = 0

  for (const s of sessions) {
    const created = new Date(s.created_at)
    const key = romeDateKey(created)
    const sessionPoints = s.pallet1 + s.pallet2 + s.pallet3

    if (weekKeys.includes(key)) {
      weekVotes += 1
      weekPoints += sessionPoints
      weekVoters.add(s.fingerprint)
      let bucket = weekDayMap.get(key)
      if (!bucket) {
        bucket = { votes: 0, voters: new Set(), points: 0 }
        weekDayMap.set(key, bucket)
      }
      bucket.votes += 1
      bucket.points += sessionPoints
      bucket.voters.add(s.fingerprint)
    }

    if (key === yesterdayKey) {
      yesterdayVotes += 1
      yesterdayVoters.add(s.fingerprint)
    }

    if (key !== dayKey) continue

    votes += 1
    totalPoints += sessionPoints
    dayVoters.add(s.fingerprint)

    const hour = romeHourKey(created)
    if (hour >= 0 && hour < 24) hourly[hour].votes += 1

    const iso = created.toISOString()
    if (!firstVoteAt || iso < firstVoteAt) firstVoteAt = iso
    if (!lastVoteAt || iso > lastVoteAt) lastVoteAt = iso

    const country = s.country && s.country.trim() ? s.country.trim().toUpperCase() : 'IT'
    countriesMap.set(country, (countriesMap.get(country) ?? 0) + 1)

    addCompany(companiesMap, companyNames, s.company1_id, s.pallet1, 'firsts')
    addCompany(companiesMap, companyNames, s.company2_id, s.pallet2, 'seconds')
    addCompany(companiesMap, companyNames, s.company3_id, s.pallet3, 'thirds')
  }

  const activeHours = hourly.filter((h) => h.votes > 0).length
  let peakHour: number | null = null
  let quietHour: number | null = null
  for (const h of hourly) {
    if (h.votes === 0) continue
    if (peakHour === null || h.votes > hourly[peakHour].votes) peakHour = h.hour
    if (quietHour === null || h.votes < hourly[quietHour].votes) quietHour = h.hour
  }

  const companies = Array.from(companiesMap.values()).sort(
    (a, b) => b.points - a.points || b.votes - a.votes || a.name.localeCompare(b.name),
  )

  const countries = Array.from(countriesMap.entries())
    .map(([country, v]) => ({ country, votes: v }))
    .sort((a, b) => b.votes - a.votes)

  const weekDays: ReportDay[] = weekKeys.map((date) => {
    const bucket = weekDayMap.get(date)
    return {
      date,
      votes: bucket?.votes ?? 0,
      uniqueVoters: bucket?.voters.size ?? 0,
      points: bucket?.points ?? 0,
    }
  })

  return {
    dayKey,
    dayLabel: romeDayLabelFormatter.format(now),
    generatedAt: now.toISOString(),
    votes,
    uniqueVoters: dayVoters.size,
    totalPoints,
    avgVotesPerHour: activeHours ? Math.round((votes / activeHours) * 10) / 10 : 0,
    activeHours,
    firstVoteAt,
    lastVoteAt,
    hourly,
    peakHour,
    quietHour,
    countries,
    companies,
    top3: companies.slice(0, 3),
    yesterday: { votes: yesterdayVotes, uniqueVoters: yesterdayVoters.size },
    week: {
      days: weekDays,
      votes: weekVotes,
      uniqueVoters: weekVoters.size,
      totalPoints: weekPoints,
    },
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatHour(hour: number): string {
  return `${pad2(hour)}:00`
}

export function formatBands(hourly: ReportHour[]): { label: string; votes: number }[] {
  const bands: { label: string; votes: number }[] = []
  for (let start = 0; start < 24; start += 3) {
    const votes = hourly.slice(start, start + 3).reduce((acc, h) => acc + h.votes, 0)
    bands.push({ label: `${pad2(start)}–${pad2(start + 3)}`, votes })
  }
  return bands
}

export function itNum(value: number): string {
  return value.toLocaleString('it-IT')
}

export function timeLabel(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return romeTimeFormatter.format(date)
}

/**
 * Elenca le chiavi giorno (YYYY-MM-DD, Europe/Rome) tra `from` e `to` inclusi.
 * Ritorna [] se l'intervallo è invalido o troppo ampio (> 31 giorni).
 */
export function enumerateDayKeys(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return []
  const start = utcNoonFromKey(from)
  const end = utcNoonFromKey(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const keys: string[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    keys.push(romeDateKey(cursor))
    if (keys.length > 31) return []
  }
  return keys
}

export interface RangeTotals {
  days: number
  votes: number
  uniqueVoters: number
  totalPoints: number
  peakDay: { date: string; votes: number } | null
}

export interface RangeReport {
  from: string
  to: string
  generatedAt: string
  days: DailyReport[]
  totals: RangeTotals
}

/**
 * Report multi-giorno: riusa `buildDailyReport` per ciascuna giornata (con
 * `now` = mezzogiorno del giorno, così il confronto "ieri" è corretto) e
 * aggrega i totali. I votanti unici del periodo sono distinti sull'intero
 * intervallo, non la somma dei per-giorno.
 */
export function buildRangeReport(
  sessions: ReportSessionRow[],
  companyNames: Map<string, string>,
  dayKeys: string[],
  now: Date = new Date(),
): RangeReport {
  const keys = [...dayKeys].sort()
  const days = keys.map((key) => buildDailyReport(sessions, companyNames, utcNoonFromKey(key)))

  const keySet = new Set(keys)
  const rangeVoters = new Set<string>()
  let votes = 0
  let totalPoints = 0
  let peakDay: { date: string; votes: number } | null = null

  for (const day of days) {
    votes += day.votes
    totalPoints += day.totalPoints
    if (!peakDay || day.votes > peakDay.votes) {
      peakDay = { date: day.dayKey, votes: day.votes }
    }
  }

  for (const s of sessions) {
    const key = romeDateKey(new Date(s.created_at))
    if (keySet.has(key)) rangeVoters.add(s.fingerprint)
  }

  return {
    from: keys[0] ?? '',
    to: keys[keys.length - 1] ?? '',
    generatedAt: now.toISOString(),
    days,
    totals: {
      days: days.length,
      votes,
      uniqueVoters: rangeVoters.size,
      totalPoints,
      peakDay,
    },
  }
}

