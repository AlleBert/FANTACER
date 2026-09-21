'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Users, TrendingUp, Vote, Wifi, Download, Upload, AlertCircle, RefreshCw } from 'lucide-react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useAdminRole } from '@/lib/use-admin-role'
import { createClient } from '@/lib/supabase/client'
import { safeSubscribe } from '@/lib/supabase/realtime'
import { useBatches } from '@/hooks/use-batches'
import { BatchFilter } from '@/components/admin/batch-filter'
import { buildHourlyTrend, buildVoteTrend, type HourBucket, type TrendPoint } from '@/lib/admin-analytics'
import { cn } from '@/lib/utils'

interface Stats {
  totalVotes: number
  uniqueVoters: number
  todayVotes: number
  yesterdayVotes: number
  activeNow: number
  onlineUsers: number
  todayByHour: HourBucket[]
}

interface DailyStats {
  date: string
  vote_count: number
  unique_voters: number
}

function formatTooltipDate(dateKey: string): string {
  try {
    return format(new Date(dateKey), 'dd MMM yyyy', { locale: it }).replace(
      / ([a-z])/,
      (_, c: string) => ` ${c.toUpperCase()}`
    )
  } catch {
    return dateKey
  }
}

function VoteTrendTooltip({
  active,
  payload,
  mode,
  todayKey,
}: {
  active?: boolean
  payload?: { payload?: TrendPoint }[]
  mode: 'daily' | 'hourly'
  todayKey: string
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null

  const title =
    mode === 'hourly'
      ? `${formatTooltipDate(todayKey)} · ${point.label}`
      : formatTooltipDate(point.key)
  const votesLabel = mode === 'hourly' ? "Voti nell'ora" : 'Voti del giorno'
  const cumulativeLabel = mode === 'hourly' ? 'Cumulato giornata' : 'Totale cumulato'

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {votesLabel}: <span className="font-semibold text-foreground">{point.votes}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {cumulativeLabel}: <span className="font-semibold text-foreground">{point.cumulative}</span>
      </p>
    </div>
  )
}

export default function PanoramicaPage() {
  const router = useRouter()
  const role = useAdminRole()
  const isViewer = role === 'viewer'
  const { batches, activeBatch, loading: batchesLoading } = useBatches()
  const [stats, setStats] = useState<Stats>({
    totalVotes: 0, uniqueVoters: 0, todayVotes: 0, yesterdayVotes: 0, activeNow: 0, onlineUsers: 0,
    todayByHour: [],
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  // auto = oraria se c'è un solo giorno di dati, altrimenti giornaliera.
  const [trendView, setTrendView] = useState<'auto' | 'daily' | 'hourly'>('auto')
  // null = "usa il batch attivo" (default); stringa = scelta esplicita ('all' = tutti).
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const effectiveBatch = selectedBatch ?? activeBatch ?? 'all'
  const batchParam =
    effectiveBatch && effectiveBatch !== 'all'
      ? `&batch=${encodeURIComponent(effectiveBatch)}`
      : ''

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const statsRes = await fetch(`/api/analytics?type=summary${batchParam}`)
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
        todayByHour: statsData.todayByHour || [],
      })
      setDailyStats(statsData.dailyStats || [])
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [batchParam])

  // Ricarica quando cambia il batch effettivo (attivo o scelto dall'admin).
  useEffect(() => {
    if (batchesLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati quando cambia il batch
    loadData()
  }, [batchesLoading, effectiveBatch, loadData])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('panoramica-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_tick' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_settings' }, () => {
        loadData()
      })
    safeSubscribe(channel)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const downloadFile = (url: string) => {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  // Ogni export scarica due file: il dettaglio (CSV/Excel) e il riepilogo
  // giornaliero in markdown. Il browser può chiedere una volta il permesso
  // per i download multipli.
  const handleExport = (format: 'csv' | 'xlsx') => {
    downloadFile(`/api/analytics?type=export&format=${format}${batchParam}`)
    downloadFile(`/api/analytics?type=report${batchParam}`)
  }

  const onlineIsGlobal = effectiveBatch !== 'all'

  const statCards = [
    { label: 'Voti Totali', value: stats.totalVotes, icon: Vote, color: 'violet' },
    { label: 'Elettori Unici', value: stats.uniqueVoters, icon: Users, color: 'blue' },
    { label: 'Voti Oggi', value: stats.todayVotes, icon: TrendingUp, color: 'emerald', diff: stats.todayVotes - stats.yesterdayVotes },
    { label: 'Votanti Ora', value: stats.activeNow, icon: Users, color: 'orange' },
    { label: onlineIsGlobal ? 'Utenti Online (globale)' : 'Utenti Online', value: stats.onlineUsers, icon: Wifi, color: 'cyan' },
  ]

  const dailySeries = useMemo(() => buildVoteTrend(dailyStats), [dailyStats])
  const hourlySeries = useMemo(() => buildHourlyTrend(stats.todayByHour), [stats.todayByHour])
  const effectiveView: 'daily' | 'hourly' =
    trendView === 'daily'
      ? 'daily'
      : trendView === 'hourly'
        ? 'hourly'
        : dailySeries.length >= 2
          ? 'daily'
          : hourlySeries.length > 0
            ? 'hourly'
            : 'daily'
  const chartData = effectiveView === 'hourly' ? hourlySeries : dailySeries
  const todayKey = dailyStats[dailyStats.length - 1]?.date ?? ''

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
      {batches.length > 0 && (
        <BatchFilter batches={batches} value={effectiveBatch} onChange={setSelectedBatch} />
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[clamp(0.65rem,2vw,0.8rem)] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} aria-hidden="true" />
                  {effectiveView === 'hourly' ? "Voti nell'ora" : 'Voti del giorno'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--foreground)' }} aria-hidden="true" />
                  {effectiveView === 'hourly' ? 'Cumulato giornata' : 'Totale cumulato'}
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-border p-0.5 text-[clamp(0.65rem,2vw,0.8rem)]">
                {([
                  ['auto', 'Auto'],
                  ['daily', 'Giornaliero'],
                  ['hourly', 'Orario'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTrendView(value)}
                    aria-pressed={trendView === value}
                    className={cn(
                      'cursor-pointer rounded-md px-2 py-1 font-medium transition-colors',
                      trendView === value
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] md:h-[300px] w-full relative">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="votesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid yAxisId="left" strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11}
                      tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip
                      content={<VoteTrendTooltip mode={effectiveView} todayKey={todayKey} />}
                      cursor={{ stroke: 'var(--border)' }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="votes"
                      name={effectiveView === 'hourly' ? "Voti nell'ora" : 'Voti del giorno'}
                      stroke="var(--primary)" strokeWidth={3} fill="url(#votesGradient)"
                      dot={{ fill: 'var(--primary)', r: 2, strokeWidth: 0 }}
                      activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative"
                      name={effectiveView === 'hourly' ? 'Cumulato giornata' : 'Totale cumulato'}
                      stroke="var(--foreground)" strokeWidth={2} dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }} />
                  </ComposedChart>
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
                <Button variant="outline" onClick={() => handleExport('xlsx')}
                  className="w-full border-border text-foreground hover:bg-secondary">
                  <Download className="h-4 w-4 mr-2" /> Export Excel
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/dashboard/import')}
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
