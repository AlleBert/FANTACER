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

const romeWeekdayFormatter = new Intl.DateTimeFormat('it-IT', {
  timeZone: ROME_TZ,
  weekday: 'short',
  day: 'numeric',
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

function formatHour(hour: number): string {
  return `${pad2(hour)}:00`
}

function formatBands(hourly: ReportHour[]): { label: string; votes: number }[] {
  const bands: { label: string; votes: number }[] = []
  for (let start = 0; start < 24; start += 3) {
    const votes = hourly.slice(start, start + 3).reduce((acc, h) => acc + h.votes, 0)
    bands.push({ label: `${pad2(start)}–${pad2(start + 3)}`, votes })
  }
  return bands
}

function itNum(value: number): string {
  return value.toLocaleString('it-IT')
}

function timeLabel(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return romeTimeFormatter.format(date)
}

/**
 * Rende il riepilogo come testo markdown leggibile, pronto da copiare nelle
 * stories. Il batch è opzionale e serve solo come etichetta.
 */
export function renderDailyReportText(report: DailyReport, batchLabel?: string): string {
  const lines: string[] = []
  const peak = report.peakHour

  lines.push('# FANTACER — Riepilogo giornata')
  lines.push('')
  lines.push(
    `**${report.dayLabel}**${batchLabel ? ` · Batch: ${batchLabel}` : ''} · Generato: ${timeLabel(
      report.generatedAt,
    )}`,
  )
  lines.push('')
  lines.push('## In breve')
  lines.push(`- Voti totali: ${itNum(report.votes)}`)
  lines.push(`- Votanti singoli: ${itNum(report.uniqueVoters)}`)
  lines.push(`- Punti assegnati: ${itNum(report.totalPoints)}`)
  lines.push(`- Media voti/ora attiva: ${itNum(report.avgVotesPerHour)}`)
  lines.push(`- Ore attive: ${itNum(report.activeHours)}`)
  lines.push(
    `- Fascia di punta: ${
      peak === null
        ? '—'
        : `${formatHour(peak)}–${formatHour(peak + 1)} (${itNum(report.hourly[peak].votes)} voti)`
    }`,
  )
  lines.push(
    `- Primo voto: ${timeLabel(report.firstVoteAt)} · Ultimo voto: ${timeLabel(report.lastVoteAt)}`,
  )
  lines.push('')
  lines.push('## Fasce orarie (Europe/Rome)')
  lines.push('')
  lines.push('| Fascia | Voti |')
  lines.push('| --- | ---: |')
  for (const band of formatBands(report.hourly)) {
    lines.push(`| ${band.label} | ${itNum(band.votes)} |`)
  }
  lines.push('')

  lines.push('## Top aziende del giorno')
  lines.push('')
  if (report.top3.length === 0) {
    lines.push('Nessun voto registrato.')
  } else {
    report.top3.forEach((company, index) => {
      lines.push(
        `${index + 1}. **${company.name}** — ${itNum(company.points)} punti (${itNum(
          company.votes,
        )} voti)`,
      )
    })
  }
  lines.push('')

  lines.push('## Classifica completa del giorno')
  lines.push('')
  if (report.companies.length === 0) {
    lines.push('Nessun voto registrato.')
  } else {
    lines.push('| # | Azienda | Punti | Voti | 1° | 2° | 3° |')
    lines.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: |')
    report.companies.forEach((company, index) => {
      lines.push(
        `| ${index + 1} | ${company.name} | ${itNum(company.points)} | ${itNum(
          company.votes,
        )} | ${company.firsts} | ${company.seconds} | ${company.thirds} |`,
      )
    })
  }
  lines.push('')

  lines.push('## Paesi')
  lines.push('')
  if (report.countries.length === 0) {
    lines.push('Nessun dato.')
  } else {
    lines.push(report.countries.map((c) => `${c.country} (${itNum(c.votes)})`).join(' · '))
  }
  lines.push('')

  lines.push('## Confronto con ieri')
  lines.push(
    `- Voti: ${itNum(report.yesterday.votes)} · Votanti singoli: ${itNum(
      report.yesterday.uniqueVoters,
    )}`,
  )
  lines.push('')

  lines.push('## Cumulato settimana (lun–dom)')
  lines.push(
    `- Voti: ${itNum(report.week.votes)} · Votanti singoli: ${itNum(
      report.week.uniqueVoters,
    )} · Punti: ${itNum(report.week.totalPoints)}`,
  )
  lines.push('')
  lines.push('| Giorno | Voti | Votanti | Punti |')
  lines.push('| --- | ---: | ---: | ---: |')
  for (const day of report.week.days) {
    const label = romeWeekdayFormatter.format(utcNoonFromKey(day.date))
    lines.push(
      `| ${label} | ${itNum(day.votes)} | ${itNum(day.uniqueVoters)} | ${itNum(day.points)} |`,
    )
  }
  lines.push('')

  return lines.join('\n')
}

