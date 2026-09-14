'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { CompanyCardList } from '@/components/admin/company-card-list'
import { CompanyTable } from '@/components/admin/company-table'
import { BatchFilter } from '@/components/admin/batch-filter'
import { useBatches } from '@/hooks/use-batches'
import { createClient } from '@/lib/supabase/client'
import { safeSubscribe } from '@/lib/supabase/realtime'

interface Company {
  rank: number
  id: string
  name: string
  category: string
  image_url: string | null
  votes: number
  trend: number
}

export default function AziendePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const { batches, activeBatch, loading: batchesLoading } = useBatches()
  // null = "usa il batch attivo" (default); stringa = scelta esplicita.
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  const effectiveBatch = selectedBatch ?? activeBatch ?? 'all'
  const batchParam =
    effectiveBatch && effectiveBatch !== 'all'
      ? `?batch=${encodeURIComponent(effectiveBatch)}`
      : ''

  const loadCompanies = useCallback(async () => {
    const res = await fetch(`/api/admin/companies${batchParam}`)
    const data = await res.json()
    setCompanies(data.data || [])
    setLoading(false)
  }, [batchParam])

  useEffect(() => {
    if (batchesLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati quando cambia il batch
    loadCompanies()
  }, [batchesLoading, effectiveBatch, loadCompanies])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('companies-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        loadCompanies()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_tick' }, () => {
        loadCompanies()
      })
    safeSubscribe(channel)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadCompanies])

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground tracking-tight">Aziende</h1>
          <p className="text-[clamp(0.75rem,2.5vw,1rem)] text-muted-foreground">Classifica aziende e voti</p>
        </div>
      </header>

      {batches.length > 0 && (
        <BatchFilter
          batches={batches}
          value={effectiveBatch}
          onChange={(v) => { setLoading(true); setSelectedBatch(v) }}
        />
      )}

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
            <Users className="h-5 w-5" />
            Classifica Aziende
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="lg:hidden">
                <CompanyCardList data={companies} />
              </div>
              {/* Desktop: full table */}
              <div className="hidden lg:block">
                <CompanyTable data={companies} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
