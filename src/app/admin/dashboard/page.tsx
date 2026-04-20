'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  BarChart3, 
  Users, 
  Vote, 
  Download, 
  Upload, 
  Settings, 
  LogOut,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { CompanyTable } from '@/components/admin/company-table'
import { VoteLogTable } from '@/components/admin/vote-log-table'

interface Stats {
  totalVotes: number
  uniqueVoters: number
  todayVotes: number
  activeNow: number
}

interface DailyStats {
  date: string
  vote_count: number
  unique_voters: number
}

interface Vote {
  id: string
  timestamp: string
  company: string
  fingerprint: string
  country: string
  device: string
}

interface Company {
  rank: number
  id: string
  name: string
  category: string
  image_url: string | null
  votes: number
  trend: number
}

interface VotePagination {
  page: number
  limit: number
  total: number
  pages: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    totalVotes: 0,
    uniqueVoters: 0,
    todayVotes: 0,
    activeNow: 0
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [votePagination, setVotePagination] = useState<VotePagination>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0
  })
  const [voteSearch, setVoteSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const session = localStorage.getItem('admin_session')
      if (!session) {
        router.push('/admin/login')
        return
      }

      const res = await fetch('/api/admin/login', {
        headers: { Authorization: `Bearer ${session}` }
      })
      
      if (!res.ok) {
        localStorage.removeItem('admin_session')
        router.push('/admin/login')
        return
      }

      loadData()
    }

    checkAuth()
  }, [router])

  const loadData = async () => {
    setLoading(true)
    try {
      const statsRes = await fetch('/api/analytics?type=summary')
      const statsData = await statsRes.json()
      setStats({
        totalVotes: statsData.totalVotes || 0,
        uniqueVoters: statsData.uniqueVoters || 0,
        todayVotes: statsData.dailyStats?.[0]?.vote_count || 0,
        activeNow: 0
      })
      setDailyStats(statsData.dailyStats || [])

      const companiesRes = await fetch('/api/admin/companies')
      const companiesData = await companiesRes.json()
      setCompanies(companiesData.data || [])

      loadVotes(1, '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadVotes = async (page: number, search: string) => {
    const params = new URLSearchParams({ page: page.toString(), limit: '25' })
    if (search) params.append('search', search)
    const res = await fetch(`/api/admin/votes?${params}`)
    const data = await res.json()
    setVotes(data.data || [])
    setVotePagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_session')
    router.push('/admin/login')
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    window.open(`/api/analytics?type=export&format=${format}`, '_blank')
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-xl">Admin Dashboard</h1>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <div className="container px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Vote className="h-4 w-4" />
                <span className="text-xs">Voti Totali</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalVotes}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Elettori Unici</span>
              </div>
              <div className="text-2xl font-bold">{stats.uniqueVoters}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Oggi</span>
              </div>
              <div className="text-2xl font-bold">{stats.todayVotes}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Attivi Ora</span>
              </div>
              <div className="text-2xl font-bold">{stats.activeNow}</div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/import')}>
            <Upload className="h-4 w-4 mr-2" />
            Import Aziende
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Impostazioni
          </Button>
        </div>

        {/* Chart placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Andamento Votazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <span>Caricamento...</span>
                </div>
              ) : dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...dailyStats].reverse()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E2A26" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#8C8882" 
                      fontSize={12}
                      tickFormatter={(v) => {
                        try { return format(new Date(v), 'dd/MM', { locale: it }) } 
                        catch { return v }
                      }}
                    />
                    <YAxis stroke="#8C8882" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#181614', 
                        border: '1px solid #2E2A26',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#F0EDE8' }}
                      itemStyle={{ color: '#FF6A1A' }}
                      formatter={(value) => [typeof value === 'number' ? value : 0, '']}
                      labelFormatter={(label) => {
                        try { return format(new Date(label), 'dd MMMM yyyy', { locale: it }) }
                        catch { return label }
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="vote_count" 
                      stroke="#FF6A1A" 
                      strokeWidth={2}
                      dot={{ fill: '#FF6A1A', strokeWidth: 0 }}
                      name="Voti"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unique_voters" 
                      stroke="#8C8882" 
                      strokeWidth={2}
                      dot={{ fill: '#8C8882', strokeWidth: 0 }}
                      name="Elettori"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#8C8882]">
                  Nessun dato disponibile
                </div>
              )}
            </div>
          </CardContent>
        </Card>

{/* Company Rankings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Classifica Aziende
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyTable data={companies} />
          </CardContent>
        </Card>

{/* Vote Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Registro Voti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VoteLogTable 
              data={votes} 
              pagination={votePagination}
              onPageChange={(page) => loadVotes(page, voteSearch)}
              onSearch={(search) => {
                setVoteSearch(search)
                loadVotes(1, search)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}