import {
  aggregateSummary,
  filterSessionsByBatch,
  romeDateKey,
  sanitizeCsvValue,
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
