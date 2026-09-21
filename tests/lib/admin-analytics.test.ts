import {
  aggregateSummary,
  buildDailyReport,
  buildHourlyTrend,
  buildVoteTrend,
  filterSessionsByBatch,
  renderDailyReportText,
  romeDateKey,
  romeHourKey,
  sanitizeCsvValue,
  type DailyStat,
  type ReportSessionRow,
  type SessionSummaryRow,
} from '@/lib/admin-analytics'

const session = (
  created_at: string,
  fingerprint: string,
  companies: [string, string, string],
): SessionSummaryRow => ({
  created_at,
  fingerprint,
  company1_id: companies[0],
  company2_id: companies[1],
  company3_id: companies[2],
})

describe('romeDateKey', () => {
  it('formatta in YYYY-MM-DD', () => {
    expect(romeDateKey(new Date('2026-09-14T12:00:00Z'))).toBe('2026-09-14')
  })

  it('usa il fuso Europe/Rome (mezzanotte UTC è già il giorno dopo)', () => {
    // 23:30 UTC del 13/09 = 01:30 a Roma del 14/09 (CEST)
    expect(romeDateKey(new Date('2026-09-13T23:30:00Z'))).toBe('2026-09-14')
  })

  it('ritorna stringa vuota su data invalida', () => {
    expect(romeDateKey(new Date('invalid'))).toBe('')
  })
})

describe('filterSessionsByBatch', () => {
  const s = session('2026-09-14T10:00:00Z', 'a', ['c1', 'c2', 'c3'])
  const ids = new Set(['c2'])

  it('tiene la sessione se una qualsiasi company è nel batch', () => {
    expect(filterSessionsByBatch([s], 'Fiera', ids)).toHaveLength(1)
  })

  it('scarta la sessione se nessuna company è nel batch', () => {
    expect(filterSessionsByBatch([s], 'Fiera', new Set(['zzz']))).toHaveLength(0)
  })

  it('non filtra con batch null o all', () => {
    expect(filterSessionsByBatch([s], null, new Set())).toHaveLength(1)
    expect(filterSessionsByBatch([s], 'all', new Set())).toHaveLength(1)
  })
})

describe('aggregateSummary', () => {
  const now = new Date('2026-09-14T12:00:00Z')
  const sessions = [
    // oggi, dentro la finestra "attivi" (15 min)
    session('2026-09-14T11:55:00Z', 'fp-a', ['c1', 'c2', 'c3']),
    // oggi, fuori finestra, stesso elettore
    session('2026-09-14T08:00:00Z', 'fp-a', ['c1', 'c2', 'c4']),
    // ieri
    session('2026-09-13T10:00:00Z', 'fp-b', ['c1', 'c5', 'c6']),
  ]

  it('conta sessioni, elettori unici, oggi/ieri e attivi ora', () => {
    const summary = aggregateSummary(sessions, 7, now)
    expect(summary.totalVotes).toBe(3)
    expect(summary.uniqueVoters).toBe(2)
    expect(summary.todayVotes).toBe(2)
    expect(summary.yesterdayVotes).toBe(1)
    expect(summary.activeNow).toBe(1)
    expect(summary.onlineUsers).toBe(7)
  })

  it('raggruppa i voti di oggi per ora (Europe/Rome)', () => {
    const summary = aggregateSummary(sessions, 0, now)
    expect(summary.todayByHour).toHaveLength(24)
    expect(summary.todayByHour[10].votes).toBe(1)
    expect(summary.todayByHour[13].votes).toBe(1)
    expect(summary.todayByHour.reduce((acc, h) => acc + h.votes, 0)).toBe(2)
  })

  it('aggrega per giorno (niente date duplicate) e ultimi 30 giorni', () => {
    const summary = aggregateSummary(sessions, 0, now)
    expect(summary.dailyStats).toHaveLength(30)

    const today = summary.dailyStats[summary.dailyStats.length - 1]
    expect(today.date).toBe('2026-09-14')
    expect(today.vote_count).toBe(2)
    expect(today.unique_voters).toBe(1)

    const yesterday = summary.dailyStats[summary.dailyStats.length - 2]
    expect(yesterday.date).toBe('2026-09-13')
    expect(yesterday.vote_count).toBe(1)
    expect(yesterday.unique_voters).toBe(1)
  })

  it('gli elettori unici totali non sono la somma dei distinti giornalieri', () => {
    const summary = aggregateSummary(
      [
        session('2026-09-14T10:00:00Z', 'fp-a', ['c1', 'c2', 'c3']),
        session('2026-09-13T10:00:00Z', 'fp-a', ['c1', 'c2', 'c3']),
      ],
      0,
      now,
    )
    expect(summary.uniqueVoters).toBe(1)
    const perDay = summary.dailyStats
      .filter((d) => d.unique_voters > 0)
      .reduce((acc, d) => acc + d.unique_voters, 0)
    expect(perDay).toBe(2)
  })
})

describe('sanitizeCsvValue', () => {
  it('neutralizza le formule', () => {
    expect(sanitizeCsvValue('=cmd|calc')).toBe("'=cmd|calc")
    expect(sanitizeCsvValue('+1')).toBe("'+1")
    expect(sanitizeCsvValue('-1')).toBe("'-1")
    expect(sanitizeCsvValue('@x')).toBe("'@x")
  })

  it('lascia invariati i valori normali e gestisce null', () => {
    expect(sanitizeCsvValue('Ceramiche X')).toBe('Ceramiche X')
    expect(sanitizeCsvValue(4)).toBe('4')
    expect(sanitizeCsvValue(null)).toBe('')
  })
})

const trendDay = (date: string, vote_count: number, unique_voters = vote_count): DailyStat => ({
  date,
  vote_count,
  unique_voters,
})

describe('buildVoteTrend', () => {
  it('rimuove i giorni a zero iniziali e finali e calcola il cumulato', () => {
    const trend = buildVoteTrend([
      trendDay('2026-09-17', 0),
      trendDay('2026-09-18', 0),
      trendDay('2026-09-19', 10),
      trendDay('2026-09-20', 20),
      trendDay('2026-09-21', 30),
      trendDay('2026-09-22', 0),
      trendDay('2026-09-23', 0),
    ])
    expect(trend.map((p) => p.key)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21'])
    expect(trend.map((p) => p.label)).toEqual(['19/09', '20/09', '21/09'])
    expect(trend.map((p) => p.votes)).toEqual([10, 20, 30])
    expect(trend.map((p) => p.cumulative)).toEqual([10, 30, 60])
  })

  it('mantiene gli zeri interni', () => {
    const trend = buildVoteTrend([
      trendDay('2026-09-19', 5),
      trendDay('2026-09-20', 0),
      trendDay('2026-09-21', 5),
    ])
    expect(trend).toHaveLength(3)
    expect(trend[1]).toEqual({ key: '2026-09-20', label: '20/09', votes: 0, cumulative: 5 })
    expect(trend[2].cumulative).toBe(10)
  })

  it('ritorna serie vuota se tutti i giorni sono a zero', () => {
    expect(buildVoteTrend([trendDay('2026-09-19', 0), trendDay('2026-09-20', 0)])).toEqual([])
  })

  it('ritorna serie vuota su input vuoto', () => {
    expect(buildVoteTrend([])).toEqual([])
  })
})

describe('buildHourlyTrend', () => {
  const buckets = (votes: Record<number, number>) =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, votes: votes[hour] ?? 0 }))

  it('mostra solo le ore attive con un\'ora di contesto ai bordi', () => {
    const trend = buildHourlyTrend(buckets({ 10: 5, 11: 7, 12: 3 }))
    // 09 (contesto), 10, 11, 12, 13 (contesto)
    expect(trend.map((p) => p.key)).toEqual(['9', '10', '11', '12', '13'])
    expect(trend.map((p) => p.label)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00'])
    expect(trend.map((p) => p.votes)).toEqual([0, 5, 7, 3, 0])
  })

  it('cumula infragiornalmente', () => {
    const trend = buildHourlyTrend(buckets({ 10: 5, 11: 7 }))
    expect(trend.map((p) => p.cumulative)).toEqual([0, 5, 12, 12])
  })

  it('non aggiunge contesto oltre i bordi della giornata', () => {
    const trend = buildHourlyTrend(buckets({ 0: 4 }))
    expect(trend.map((p) => p.key)).toEqual(['0', '1'])
    expect(trend[0].cumulative).toBe(4)
  })

  it('ritorna serie vuota se nessuna ora ha voti', () => {
    expect(buildHourlyTrend(buckets({}))).toEqual([])
  })
})

const reportSession = (
  created_at: string,
  fingerprint: string,
  companies: [string, string, string],
  country = 'IT',
): ReportSessionRow => ({
  created_at,
  fingerprint,
  company1_id: companies[0],
  company2_id: companies[1],
  company3_id: companies[2],
  pallet1: 4,
  pallet2: 2,
  pallet3: 1,
  country,
})

const NAMES = new Map([
  ['c1', 'Uno'],
  ['c2', 'Due'],
  ['c3', 'Tre'],
  ['c4', 'Quattro'],
  ['c5', 'Cinque'],
])

describe('romeHourKey', () => {
  it('converte in ora Europe/Rome', () => {
    expect(romeHourKey(new Date('2026-09-21T07:30:00Z'))).toBe(9)
  })

  it('gestisce il cambio giorno a mezzanotte', () => {
    expect(romeHourKey(new Date('2026-09-21T22:30:00Z'))).toBe(0)
  })

  it('ritorna -1 su data invalida', () => {
    expect(romeHourKey(new Date('invalid'))).toBe(-1)
  })
})

describe('buildDailyReport', () => {
  // Mercoledì 23/09/2026: settimana lun 21 – dom 27.
  const now = new Date('2026-09-23T18:00:00Z')
  const sessions = [
    reportSession('2026-09-23T09:00:00Z', 'fp-a', ['c1', 'c2', 'c3'], 'IT'),
    reportSession('2026-09-23T12:00:00Z', 'fp-b', ['c1', 'c4', 'c5'], 'DE'),
    reportSession('2026-09-22T10:00:00Z', 'fp-c', ['c2', 'c3', 'c4']),
    reportSession('2026-09-21T10:00:00Z', 'fp-d', ['c3', 'c4', 'c5']),
    // domenica della settimana precedente: fuori dal cumulato settimanale
    reportSession('2026-09-20T10:00:00Z', 'fp-e', ['c1', 'c2', 'c3']),
  ]

  it('aggrega i numeri del giorno corrente', () => {
    const report = buildDailyReport(sessions, NAMES, now)
    expect(report.dayKey).toBe('2026-09-23')
    expect(report.votes).toBe(2)
    expect(report.uniqueVoters).toBe(2)
    expect(report.totalPoints).toBe(14)
    expect(report.activeHours).toBe(2)
    expect(report.avgVotesPerHour).toBe(1)
    expect(report.firstVoteAt).toBe('2026-09-23T09:00:00.000Z')
    expect(report.lastVoteAt).toBe('2026-09-23T12:00:00.000Z')
  })

  it('distribuisce i voti per fascia oraria locale', () => {
    const report = buildDailyReport(sessions, NAMES, now)
    expect(report.hourly).toHaveLength(24)
    expect(report.hourly[11].votes).toBe(1)
    expect(report.hourly[14].votes).toBe(1)
    expect(report.hourly.reduce((acc, h) => acc + h.votes, 0)).toBe(2)
    expect(report.peakHour).toBe(11)
    expect(report.quietHour).toBe(11)
  })

  it('classifica le aziende del giorno per punti', () => {
    const report = buildDailyReport(sessions, NAMES, now)
    expect(report.companies).toHaveLength(5)
    expect(report.top3[0]).toMatchObject({ id: 'c1', name: 'Uno', points: 8, votes: 2, firsts: 2 })
    expect(report.companies[0].points).toBe(8)
    expect(report.companies.reduce((acc, c) => acc + c.points, 0)).toBe(14)
  })

  it('conta i paesi e confronta con ieri', () => {
    const report = buildDailyReport(sessions, NAMES, now)
    expect(report.countries).toEqual([
      { country: 'IT', votes: 1 },
      { country: 'DE', votes: 1 },
    ])
    expect(report.yesterday).toEqual({ votes: 1, uniqueVoters: 1 })
  })

  it('cumula la settimana lun–dom escludendo i giorni fuori settimana', () => {
    const report = buildDailyReport(sessions, NAMES, now)
    expect(report.week.days).toHaveLength(7)
    expect(report.week.votes).toBe(4)
    expect(report.week.uniqueVoters).toBe(4)
    expect(report.week.totalPoints).toBe(28)
    const monday = report.week.days.find((d) => d.date === '2026-09-21')
    expect(monday?.votes).toBe(1)
    const wednesday = report.week.days.find((d) => d.date === '2026-09-23')
    expect(wednesday?.votes).toBe(2)
  })

  it('gestisce una giornata senza voti', () => {
    const report = buildDailyReport([], NAMES, now)
    expect(report.votes).toBe(0)
    expect(report.uniqueVoters).toBe(0)
    expect(report.avgVotesPerHour).toBe(0)
    expect(report.peakHour).toBeNull()
    expect(report.quietHour).toBeNull()
    expect(report.top3).toEqual([])
    expect(report.firstVoteAt).toBeNull()
    expect(report.lastVoteAt).toBeNull()
    expect(report.week.votes).toBe(0)
  })
})

describe('renderDailyReportText', () => {
  const now = new Date('2026-09-23T18:00:00Z')

  it('include numeri, classifica e cumulato settimanale', () => {
    const report = buildDailyReport(
      [
        reportSession('2026-09-23T09:00:00Z', 'fp-a', ['c1', 'c2', 'c3']),
        reportSession('2026-09-23T12:00:00Z', 'fp-b', ['c1', 'c4', 'c5']),
      ],
      NAMES,
      now,
    )
    const text = renderDailyReportText(report, 'Fiera')
    expect(text).toContain('# FANTACER — Riepilogo giornata')
    expect(text).toContain('Batch: Fiera')
    expect(text).toContain('- Voti totali: 2')
    expect(text).toContain('- Votanti singoli: 2')
    expect(text).toContain('Primo voto: 11:00')
    expect(text).toContain('Ultimo voto: 14:00')
    expect(text).toContain('Uno')
    expect(text).toContain('Cumulato settimana')
  })

  it('non va in errore su giornata vuota', () => {
    const report = buildDailyReport([], NAMES, now)
    const text = renderDailyReportText(report)
    expect(text).toContain('Nessun voto registrato.')
  })
})
