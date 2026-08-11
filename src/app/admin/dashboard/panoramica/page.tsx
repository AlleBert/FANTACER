'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Users, TrendingUp, Vote, Wifi, Download, Upload, AlertCircle, RefreshCw } from 'lucide-react'
import { LineChart as RechartLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/use-admin-role'

interface Stats {
  totalVotes: number
  uniqueVoters: number
  todayVotes: number
  yesterdayVotes: number
  activeNow: number
  onlineUsers: number
}

interface DailyStats {
  date: string
  vote_count: number
  unique_voters: number
}

export default function PanoramicaPage() {
  const router = useRouter()
  const role = useAdminRole()
  const isViewer = role === 'viewer'
  const [stats, setStats] = useState<Stats>({
    totalVotes: 0, uniqueVoters: 0, todayVotes: 0, yesterdayVotes: 0, activeNow: 0, onlineUsers: 0,
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [batchInfo, setBatchInfo] = useState<{ activeBatch: string; batches: { name: string; companyCount: number; voteCount: number }[] } | null>(null)
  const [selectedBatch, setSelectedBatch] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const statsRes = await fetch('/api/analytics?type=summary')
      if (!statsRes.ok) {
        throw new Error(`Errore ${statsRes.status}: ${statsRes.statusText}`)
      }
      const statsData = await statsRes.json()
      setStats({
        totalVotes: statsData.totalVotes || 0,
        uniqueVoters: statsData.uniqueVoters || 0,
        todayVotes: statsData.todayVotes || 0,
        yesterdayVotes: statsData.yesterdayVotes || 0,
        activeNow: statsData.activeNow || 0,
        onlineUsers: statsData.onlineUsers || 0,
      })
      setDailyStats(statsData.dailyStats || [])

      const batchRes = await fetch('/api/admin/batch')
      const batchData = await batchRes.json()
      setBatchInfo(batchData)
      setSelectedBatch(batchData.activeBatch)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const doLoad = () => {
      return Promise.all([
        fetch('/api/analytics?type=summary').then(r => r.json()),
        fetch('/api/admin/batch').then(r => r.json()),
      ]).then(([statsData, batchData]) => {
        setStats({
          totalVotes: statsData.totalVotes || 0,
          uniqueVoters: statsData.uniqueVoters || 0,
          todayVotes: statsData.todayVotes || 0,
          yesterdayVotes: statsData.yesterdayVotes || 0,
          activeNow: statsData.activeNow || 0,
          onlineUsers: statsData.onlineUsers || 0,
        })
        setDailyStats(statsData.dailyStats || [])
        setBatchInfo(batchData)
        setSelectedBatch(batchData.activeBatch)
        setLoading(false)
      }).catch(e => {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Errore di caricamento')
        setLoading(false)
      })
    }
    doLoad()
    intervalRef.current = setInterval(doLoad, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleExport = (format: 'csv' | 'excel') => {
    window.open(`/api/analytics?type=export&format=${format}`, '_blank')
  }

  const statCards = [
    { label: 'Voti Totali', value: stats.totalVotes, icon: Vote, color: 'violet' },
    { label: 'Elettori Unici', value: stats.uniqueVoters, icon: Users, color: 'blue' },
    { label: 'Voti Oggi', value: stats.todayVotes, icon: TrendingUp, color: 'emerald', diff: stats.todayVotes - stats.yesterdayVotes },
    { label: 'Votanti Ora', value: stats.activeNow, icon: Users, color: 'orange' },
    { label: 'Utenti Online', value: stats.onlineUsers, icon: Wifi, color: 'cyan' },
  ]

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground tracking-tight">Panoramica</h1>
          <p className="text-[clamp(0.75rem,2.5vw,1rem)] text-muted-foreground">Monitoraggio votazioni e statistiche</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)}
          className="h-10 border-border text-foreground hover:bg-secondary">
          <RefreshCw className="h-4 w-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">Aggiorna</span>
        </Button>
      </header>

      {/* Batch selector */}
      {batchInfo && batchInfo.batches.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setSelectedBatch('all')}
            className={`px-3 py-2 text-[clamp(0.75rem,2vw,0.875rem)] rounded-full transition-colors ${
              selectedBatch === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}>Tutti</button>
          {batchInfo.batches.map(batch => (
            <button key={batch.name} onClick={() => setSelectedBatch(batch.name)}
              className={`px-3 py-2 text-[clamp(0.75rem,2vw,0.875rem)] rounded-full transition-colors ${
                selectedBatch === batch.name ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}>{batch.name}</button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => loadData(true)} className="ml-auto h-7 text-xs">Riprova</Button>
        </div>
      )}

      {/* Stats — responsive grid: 2 cols mobile/tablet, 5 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((s) => {
          const colorMap: Record<string, string> = {
            violet: 'from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400',
            blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400',
            emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
            orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-600 dark:text-orange-400',
            cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
          }
          const Icon = s.icon
          return (
            <Card key={s.label}
              className={`w-full bg-gradient-to-br ${colorMap[s.color]}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[clamp(0.65rem,2vw,0.8rem)] font-medium uppercase tracking-wide">{s.label}</p>
                    <p className="text-[clamp(1.1rem,4vw,1.75rem)] font-bold text-foreground mt-1">{s.value}</p>
                  </div>
                  <div className="p-2 bg-background/40 rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {'diff' in s && s.diff !== undefined && (
                  <p className="text-[clamp(0.65rem,2vw,0.8rem)] text-muted-foreground mt-2">
                    {s.diff >= 0 ? '+' : ''}{s.diff} vs ieri
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart + Export side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border shadow-sm min-w-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-[clamp(1rem,3vw,1.25rem)]">
              <BarChart3 className="h-5 w-5 text-primary" />
              Andamento Votazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] md:h-[300px] w-full relative">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartLine data={[...dailyStats].reverse()}
                    margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false}
                      tickFormatter={(v: string) => {
                        try { return format(new Date(v), 'dd/MM', { locale: it }) }
                        catch { return v }
                      }} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{
                      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                      itemStyle={{ fontSize: '12px' }}
                      labelFormatter={(label) => {
                        try { return format(new Date(label as string), 'dd MMMM yyyy', { locale: it }) }
                        catch { return label as string }
                      }} />
                    <Line type="monotone" dataKey="vote_count" stroke="var(--primary)"
                      strokeWidth={3} dot={{ fill: 'var(--primary)', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }} name="Voti" />
                    <Line type="monotone" dataKey="unique_voters" stroke="var(--muted-foreground)"
                      strokeWidth={2} strokeDasharray="5 5" dot={false} name="Elettori" />
                  </RechartLine>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                  Nessun dato disponibile
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-[clamp(1rem,3vw,1.25rem)]">Strumenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isViewer ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Modalità sola lettura: esportazione e import riservati agli amministratori.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  Esporta dati o importa aziende.
                </p>
                <Button onClick={() => handleExport('csv')}
                  className="w-full bg-primary hover:bg-primary/90 text-white">
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
                <Button variant="outline" onClick={() => handleExport('excel')}
                  className="w-full border-border text-foreground hover:bg-secondary">
                  <Download className="h-4 w-4 mr-2" /> Export Excel
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/import')}
                  className="w-full border-border text-foreground hover:bg-secondary">
                  <Upload className="h-4 w-4 mr-2" /> Import Aziende
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
