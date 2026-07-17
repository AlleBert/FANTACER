'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { CompanyCardList } from '@/components/admin/company-card-list'
import { CompanyTable } from '@/components/admin/company-table'

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

  useEffect(() => {
    fetch('/api/admin/companies')
      .then(res => res.json())
      .then(data => { setCompanies(data.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between pl-10 md:pl-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Aziende</h1>
          <p className="text-sm text-muted-foreground">Classifica aziende e voti</p>
        </div>
      </header>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
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
              <div className="md:hidden">
                <CompanyCardList data={companies} />
              </div>
              {/* Desktop: full table */}
              <div className="hidden md:block">
                <CompanyTable data={companies} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
