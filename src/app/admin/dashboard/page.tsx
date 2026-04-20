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

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    totalVotes: 0,
    uniqueVoters: 0,
    todayVotes: 0,
    activeNow: 0
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
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
      const res = await fetch('/api/analytics?type=summary')
      const data = await res.json()
      setStats({
        totalVotes: data.totalVotes || 0,
        uniqueVoters: data.uniqueVoters || 0,
        todayVotes: data.dailyStats?.[0]?.vote_count || 0,
        activeNow: 0
      })
      setDailyStats(data.dailyStats || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
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
            <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
              {loading ? (
                <span>Caricamento...</span>
              ) : dailyStats.length > 0 ? (
                <div className="w-full space-y-2">
                  {dailyStats.slice(0, 5).map((day, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-20 text-xs">{day.date}</span>
                      <div 
                        className="h-6 bg-primary rounded" 
                        style={{ width: `${Math.min(100, (day.vote_count / stats.totalVotes) * 100)}%` }}
                      />
                      <span className="text-xs">{day.vote_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">Nessun dato disponibile</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}