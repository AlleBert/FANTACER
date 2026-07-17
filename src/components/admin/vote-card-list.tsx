'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Vote {
  id: string
  timestamp: string
  company: string
  fingerprint: string
  country: string
  device: string
  comment: string
  adjective: string
  slider_innovation: number
  slider_sales: number
  slider_wow: number
}

interface VoteCardListProps {
  data: Vote[]
  pagination: { page: number; limit: number; total: number; pages: number }
  onPageChange: (page: number) => void
  onSearch: (search: string) => void
}

export function VoteCardList({ data, pagination, onPageChange, onSearch }: VoteCardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca azienda..." onChange={(e) => onSearch(e.target.value)}
          className="pl-9 bg-background border-border text-foreground h-10" />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {data.map((vote) => (
          <div key={vote.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Main row — always visible */}
            <div
              className="flex items-start gap-3 p-4 cursor-pointer active:bg-secondary/30 transition-colors"
              onClick={() => setExpandedId(expandedId === vote.id ? null : vote.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{vote.company}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(vote.timestamp), 'dd/MM/yy HH:mm', { locale: it })}
                </p>
                {vote.comment && (
                  <p className="text-sm text-foreground/80 mt-1 line-clamp-1">{vote.comment}</p>
                )}
                {vote.adjective && (
                  <span className="inline-block mt-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {vote.adjective}
                  </span>
                )}
              </div>
              <div className="shrink-0 mt-1 text-muted-foreground">
                {expandedId === vote.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Expanded details */}
            {expandedId === vote.id && (
              <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Fingerprint</span>
                    <code className="text-xs font-mono">{vote.fingerprint?.substring(0, 12)}...</code>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Device</span>
                    <span className="text-xs">{vote.device || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Paese</span>
                    <span className="text-xs">{vote.country || 'IT'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Innovazione</span>
                    <span className="text-xs">{vote.slider_innovation ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Vendibilità</span>
                    <span className="text-xs">{vote.slider_sales ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Wow</span>
                    <span className="text-xs">{vote.slider_wow ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-center text-muted-foreground py-8 italic">
            Nessun voto trovato
          </p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Pagina {pagination.page} di {pagination.pages} ({pagination.total} voti)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1} className="h-10 border-border">Precedente</Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages} className="h-10 border-border">Successivo</Button>
        </div>
      </div>
    </div>
  )
}
