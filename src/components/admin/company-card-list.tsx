'use client'

import { useState, useMemo } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Company {
  rank: number
  id: string
  name: string
  category: string
  votes: number
  trend: number
}

interface CompanyCardListProps {
  data: Company[]
}

export function CompanyCardList({ data }: CompanyCardListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<'votes' | 'rank'>('votes')
  const [sortAsc, setSortAsc] = useState(false)
  const pageSize = 10

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
  }, [data, search])

  const sorted = useMemo(() => {
    const s = [...filtered]
    s.sort((a, b) => sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])
    return s
  }, [filtered, sortKey, sortAsc])

  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(sorted.length / pageSize) || 1

  const TrendIcon = ({ trend }: { trend: number }) => {
    if (trend > 0) return <span className="text-green-500 flex items-center gap-0.5 text-xs font-medium"><TrendingUp className="w-3 h-3" />+{trend}</span>
    if (trend < 0) return <span className="text-red-500 flex items-center gap-0.5 text-xs font-medium"><TrendingDown className="w-3 h-3" />{trend}</span>
    return <span className="text-muted-foreground flex items-center gap-0.5 text-xs"><Minus className="w-3 h-3" />0</span>
  }

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca azienda..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="pl-9 bg-background border-border text-foreground h-10" />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          if (sortKey === 'votes') setSortAsc(!sortAsc)
          else { setSortKey('votes'); setSortAsc(false) }
        }} className="h-10 border-border shrink-0">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {paginated.map((company) => (
          <div key={company.id}
            className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl shadow-sm">
            <span className="text-lg font-bold text-muted-foreground w-8 shrink-0 text-center">
              {company.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground truncate">{company.category}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-foreground">{company.votes}</p>
              <TrendIcon trend={company.trend} />
            </div>
          </div>
        ))}
        {paginated.length === 0 && (
          <p className="text-center text-muted-foreground py-8 italic">
            Nessuna azienda trovata
          </p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Pagina {page + 1} di {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0} className="h-10 border-border">Precedente</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1} className="h-10 border-border">Successivo</Button>
        </div>
      </div>
    </div>
  )
}
