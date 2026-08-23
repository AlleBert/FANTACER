import {
  CLUSTERS,
  getCluster,
  rankCompanies,
  type RankingCompany,
} from '@/lib/ranking'

const company = (id: string, name: string, total_pallets: number): Omit<RankingCompany, 'rank'> => ({
  id,
  name,
  image_url: null,
  total_pallets,
  vote_count: 1,
})

describe('getCluster', () => {
  it('mappa i confini di fascia correttamente', () => {
    expect(getCluster(1)).toBe('TOP20')
    expect(getCluster(20)).toBe('TOP20')
    expect(getCluster(21)).toBe('GOLD')
    expect(getCluster(50)).toBe('GOLD')
    expect(getCluster(51)).toBe('SILVER')
    expect(getCluster(100)).toBe('SILVER')
    expect(getCluster(101)).toBe('BRONZE')
    expect(getCluster(333)).toBe('BRONZE')
  })

  it('gestisce input fuori range', () => {
    expect(getCluster(0)).toBe('BRONZE')
    expect(getCluster(-5)).toBe('BRONZE')
  })

  it('espone i limiti di fascia nelle costanti', () => {
    expect(CLUSTERS.TOP20.min).toBe(1)
    expect(CLUSTERS.TOP20.max).toBe(20)
    expect(CLUSTERS.GOLD.min).toBe(21)
    expect(CLUSTERS.GOLD.max).toBe(50)
    expect(CLUSTERS.SILVER.min).toBe(51)
    expect(CLUSTERS.SILVER.max).toBe(100)
    expect(CLUSTERS.BRONZE.min).toBe(101)
    expect(CLUSTERS.BRONZE.max).toBe(333)
  })
})

describe('rankCompanies', () => {
  it('ordina per total_pallets desc e assegna rank 1-based', () => {
    const companies = [
      company('a', 'A', 5),
      company('b', 'B', 9),
      company('c', 'C', 1),
    ]
    const ranked = rankCompanies(companies)
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3])
    expect(ranked[0].name).toBe('B')
    expect(ranked[2].name).toBe('C')
  })

  it('usa name asc come tie-breaker a parità di pallet', () => {
    const companies = [
      company('a', 'Zeta', 8),
      company('b', 'Alfa', 8),
      company('c', 'Milo', 8),
    ]
    const ranked = rankCompanies(companies)
    expect(ranked.map((c) => c.name)).toEqual(['Alfa', 'Milo', 'Zeta'])
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3])
  })

  it('usa id asc come ultimo tie-breaker a parità di pallet e nome', () => {
    const companies = [
      company('zzz-0002', 'Pari', 8),
      company('zzz-0001', 'Pari', 8),
    ]
    const ranked = rankCompanies(companies)
    expect(ranked.map((c) => c.id)).toEqual(['zzz-0001', 'zzz-0002'])
  })

  it.each([
    [20, 'TOP20', 'GOLD'],
    [50, 'GOLD', 'SILVER'],
    [100, 'SILVER', 'BRONZE'],
  ])('risolve il pareggio al confine %s/%s', (hi, cHi, cLo) => {
    const input: Array<Omit<RankingCompany, 'rank'>> = []
    for (let i = 1; i <= hi; i++) {
      input.push(company(`c${String(i).padStart(3, '0')}`, `Name ${i}`, 1000 - i))
    }
    // due aziende a parità di punteggio al confine: una prende il #hi, l'altra #hi+1
    input.push(company('zzz-0001', 'Confine A', 1000 - hi))
    input.push(company('zzz-0002', 'Confine B', 1000 - hi))

    const ranked = rankCompanies(input)
    const rHi = ranked[hi - 1]
    const rLo = ranked[hi]

    expect(rHi.rank).toBe(hi)
    expect(rLo.rank).toBe(hi + 1)
    // a parità di punteggio, l'ordine alfabetico decide: A < B
    expect(rHi.name).toBe('Confine A')
    expect(rLo.name).toBe('Confine B')
    expect(getCluster(rHi.rank)).toBe(cHi)
    expect(getCluster(rLo.rank)).toBe(cLo)
  })

  it('non muta l\'array in input', () => {
    const input = [company('a', 'A', 5), company('b', 'B', 9)]
    const copy = [...input]
    rankCompanies(input)
    expect(input).toEqual(copy)
  })
})
