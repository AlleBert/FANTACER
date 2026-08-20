export type Cluster = 'TOP20' | 'GOLD' | 'SILVER' | 'BRONZE'

export interface RankingCompany {
  id: string
  name: string
  image_url: string | null
  total_pallets: number
  vote_count: number
  rank: number
}

export interface ClusterDef {
  label: string
  min: number
  max: number
  showScore: boolean
}

export const CLUSTERS: Record<Cluster, ClusterDef> = {
  TOP20: { label: 'TOP 20', min: 1, max: 20, showScore: true },
  GOLD: { label: 'GOLD', min: 21, max: 50, showScore: false },
  SILVER: { label: 'SILVER', min: 51, max: 100, showScore: false },
  BRONZE: { label: 'BRONZE', min: 101, max: 333, showScore: false },
}

export const CLUSTER_ORDER: Cluster[] = ['TOP20', 'GOLD', 'SILVER', 'BRONZE']

export function getCluster(rank: number): Cluster {
  for (const key of CLUSTER_ORDER) {
    const def = CLUSTERS[key]
    if (rank >= def.min && rank <= def.max) return key
  }
  return 'BRONZE'
}

export function rankCompanies(companies: Array<Omit<RankingCompany, 'rank'>>): RankingCompany[] {
  return [...companies]
    .sort((a, b) => {
      if (b.total_pallets !== a.total_pallets) return b.total_pallets - a.total_pallets
      if (a.name !== b.name) return a.name.localeCompare(b.name)
      return a.id.localeCompare(b.id)
    })
    .map((c, index) => ({ ...c, rank: index + 1 }))
}
