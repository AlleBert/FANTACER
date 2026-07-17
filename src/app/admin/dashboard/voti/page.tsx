'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { VoteCardList } from '@/components/admin/vote-card-list'
import { VoteLogTable } from '@/components/admin/vote-log-table'

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

interface Pagination {
  page: number; limit: number; total: number; pages: number
}

export default function VotiPage() {
  const [votes, setVotes] = useState<Vote[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadVotes = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '25' })
    if (searchTerm) params.append('search', searchTerm)
    const res = await fetch(`/api/admin/votes?${params}`)
    const data = await res.json()
    setVotes(data.data || [])
    setPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
    setLoading(false)
  }, [])

  useEffect(() => { loadVotes(1, '') }, [loadVotes])

  const handleSearch = (s: string) => { setSearch(s); loadVotes(1, s) }

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between pl-10 md:pl-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Voti</h1>
          <p className="text-sm text-muted-foreground">Registro votazioni</p>
        </div>
      </header>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registro Voti
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {loading && votes.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <VoteCardList data={votes} pagination={pagination}
                  onPageChange={(p) => loadVotes(p, search)} onSearch={handleSearch} />
              </div>
              <div className="hidden md:block">
                <VoteLogTable data={votes} pagination={pagination}
                  onPageChange={(p) => loadVotes(p, search)} onSearch={handleSearch} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
