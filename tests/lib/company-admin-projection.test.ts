import {
  projectCompanyAction,
  aggregate,
  type ProjectionInput,
} from '@/lib/company-admin-projection'

const companies = [
  { id: 'refin', name: 'REFIN', blocked: false },
  { id: 'dts', name: 'REFIN-DTS-CITY', blocked: false },
  { id: 'mar', name: 'MARINER', blocked: false },
]

const live = new Map([
  ['refin', { pallets: 100, votes: 30 }],
  ['dts', { pallets: 60, votes: 25 }],
  ['mar', { pallets: 80, votes: 20 }],
])

const sessions = [
  { company1Id: 'refin', company2Id: 'dts', company3Id: 'mar', pallet1: 4, pallet2: 2, pallet3: 1 },
  { company1Id: 'refin', company2Id: 'mar', company3Id: 'dts', pallet1: 4, pallet2: 2, pallet3: 1 },
  { company1Id: 'mar', company2Id: 'refin', company3Id: 'dts', pallet1: 4, pallet2: 2, pallet3: 1 },
]

const base: ProjectionInput = {
  companies,
  live,
  overrides: new Map(),
  sessions,
  action: { companyIds: [] },
}

describe('aggregate', () => {
  it('somma i pallet 4/2/1 e conta i voti per azienda', () => {
    const m = aggregate(sessions)
    expect(m.get('refin')).toEqual({ pallets: 10, votes: 3 })
    expect(m.get('dts')).toEqual({ pallets: 4, votes: 3 })
    expect(m.get('mar')).toEqual({ pallets: 7, votes: 3 })
  })
})

describe('projectCompanyAction', () => {
  it('block esclude l azienda dalla classifica dopo', () => {
    const r = projectCompanyAction({ ...base, action: { companyIds: ['refin'], blocked: true } })
    expect(r.before.find((c) => c.id === 'refin')).toBeDefined()
    expect(r.after.find((c) => c.id === 'refin')).toBeUndefined()
    expect(r.after[0].id).toBe('mar')
  })

  it('delete-votes ricalcola i pallet di tutte le aziende toccate', () => {
    const r = projectCompanyAction({ ...base, action: { companyIds: ['refin'], deleteVotes: true } })
    expect(r.impact.sessionsDeleted).toBe(3)
    expect(r.after.find((c) => c.id === 'refin')?.pallets).toBe(0)
    expect(r.after.find((c) => c.id === 'mar')?.pallets).toBe(0)
  })

  it('score imposta la base e non applica delta (snapshot = live)', () => {
    const r = projectCompanyAction({
      ...base,
      action: { companyIds: ['refin'], score: { pallets: 10, votes: 5 } },
    })
    expect(r.after.find((c) => c.id === 'refin')).toMatchObject({ pallets: 10, votes: 5 })
  })

  it('score null rimuove l override e torna ai voti reali', () => {
    const overrides = new Map([
      [
        'refin',
        {
          companyId: 'refin',
          basePallets: 10,
          baseVotes: 5,
          snapshotPallets: 100,
          snapshotVotes: 30,
        },
      ],
    ])
    const r = projectCompanyAction({ ...base, overrides, action: { companyIds: ['refin'], score: null } })
    expect(r.after.find((c) => c.id === 'refin')?.pallets).toBe(100)
  })

  it('unblock reinserisce con i voti reali', () => {
    const blockedCompanies = companies.map((c) =>
      c.id === 'refin' ? { ...c, blocked: true } : c,
    )
    const r = projectCompanyAction({
      ...base,
      companies: blockedCompanies,
      action: { companyIds: ['refin'], blocked: false },
    })
    expect(r.before.find((c) => c.id === 'refin')).toBeUndefined()
    expect(r.after.find((c) => c.id === 'refin')?.pallets).toBe(100)
  })

  it('score dopo delete-votes usa il live post-cancellazione come snapshot', () => {
    const r = projectCompanyAction({
      ...base,
      action: { companyIds: ['refin'], deleteVotes: true, score: { pallets: 7, votes: 3 } },
    })
    expect(r.after.find((c) => c.id === 'refin')).toMatchObject({ pallets: 7, votes: 3 })
  })
})
