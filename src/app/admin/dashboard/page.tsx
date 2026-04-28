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
  TrendingUp
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { CompanyTable } from '@/components/admin/company-table'
import { VoteLogTable } from '@/components/admin/vote-log-table'
import { AuditLogTable } from '@/components/admin/audit-log-table'
import { AdminSidebar } from '@/components/admin/sidebar'
import { ShieldAlert, Search } from 'lucide-react'

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
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditPagination, setAuditPagination] = useState<any>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0
  })
  const [auditSearch, setAuditSearch] = useState('')
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
      loadAuditLogs(1, '')
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

  const loadAuditLogs = async (page: number, search: string) => {
    const params = new URLSearchParams({ page: page.toString(), limit: '25' })
    if (search) params.append('search', search)
    const res = await fetch(`/api/admin/audit-logs?${params}`)
    const data = await res.json()
    setAuditLogs(data.data || [])
    setAuditPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    window.open(`/api/analytics?type=export&format=${format}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#0D0C0B]">
      <AdminSidebar />
      
      <main className="md:ml-[240px] min-h-screen">
        <div className="max-w-[1200px] mx-auto p-6 md:p-8 space-y-6">
          {/* Page Title */}
          <div className="pt-12 md:pt-0">
            <h1 className="text-2xl md:text-3xl font-bold text-[#F0EDE8]">
              Dashboard
            </h1>
            <p className="text-[#8C8882] mt-1">Panoramica delle votazioni</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[#8C8882] mb-2">
                  <Vote className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Voti Totali</span>
                </div>
                <div className="text-3xl font-bold text-[#F0EDE8]">{stats.totalVotes}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[#8C8882] mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Elettori Unici</span>
                </div>
                <div className="text-3xl font-bold text-[#F0EDE8]">{stats.uniqueVoters}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[#8C8882] mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Oggi</span>
                </div>
                <div className="text-3xl font-bold text-[#F0EDE8]">{stats.todayVotes}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[#8C8882] mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Attivi Ora</span>
                </div>
                <div className="text-3xl font-bold text-[#F0EDE8]">{stats.activeNow}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => handleExport('csv')}
              className="bg-[#FF6A1A] hover:bg-[#FF8040] text-white border-none"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleExport('excel')}
              className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C] hover:border-[#8C8882]"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/import')}
              className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C] hover:border-[#8C8882]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Aziende
            </Button>
          </div>

          {/* Chart */}
          <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#F0EDE8]">
                <BarChart3 className="h-5 w-5 text-[#FF6A1A]" />
                Andamento Votazioni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[#8C8882]">Caricamento...</span>
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
          <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#F0EDE8]">
                <Users className="h-5 w-5 text-[#FF6A1A]" />
                Classifica Aziende
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyTable data={companies} />
            </CardContent>
          </Card>

          {/* Vote Log Table */}
          <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#F0EDE8]">
                <Vote className="h-5 w-5 text-[#FF6A1A]" />
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

          {/* Audit Log Table */}
          <Card className="bg-[#181614] border-[#2E2A26] rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[#F0EDE8]">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                Security Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogTable 
                data={auditLogs} 
                pagination={auditPagination}
                onPageChange={(page) => loadAuditLogs(page, auditSearch)}
                onSearch={(search) => {
                  setAuditSearch(search)
                  loadAuditLogs(1, search)
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}