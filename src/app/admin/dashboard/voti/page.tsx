'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Search, Trash2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAdminRole } from '@/lib/use-admin-role'
import { useBatches } from '@/hooks/use-batches'
import { BatchFilter } from '@/components/admin/batch-filter'

interface PalletAssignment {
  company: string
  pallet: number
}

interface VoteSession {
  id: string
  timestamp: string
  fingerprint: string
  country: string
  device: string
  pallets: PalletAssignment[]
}

interface Pagination {
  page: number; limit: number; total: number; pages: number
}

export default function VotiPage() {
  const role = useAdminRole()
  const isViewer = role === 'viewer'
  const { batches, activeBatch, loading: batchesLoading } = useBatches()
  const [sessions, setSessions] = useState<VoteSession[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, pages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  // null = "usa il batch attivo" (default); stringa = scelta esplicita.
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  const [resetScope, setResetScope] = useState<'all' | 'batch'>('all')
  const [resetBatch, setResetBatch] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetResult, setResetResult] = useState<{ ok: boolean; text: string } | null>(null)

  const effectiveBatch = selectedBatch ?? activeBatch ?? 'all'
  const batchParam =
    effectiveBatch && effectiveBatch !== 'all'
      ? `&batch=${encodeURIComponent(effectiveBatch)}`
      : ''
  const resetBatchEffective = resetBatch || activeBatch || batches[0]?.name || ''

  const handleResetVotes = async () => {
    if (resetConfirm.trim().toUpperCase() !== 'RESET') return
    if (resetScope === 'batch' && !resetBatchEffective) return
    setResetLoading(true)
    setResetResult(null)
    try {
      const res = await fetch('/api/admin/votes/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: resetScope,
          batch: resetScope === 'batch' ? resetBatchEffective : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResetResult({ ok: false, text: data.error || 'Errore durante il reset' })
      } else {
        setResetResult({
          ok: true,
          text: `Cancellati ${data.votes_deleted} voti e ${data.stats_deleted} righe daily_stats.`,
        })
        setResetConfirm('')
        loadVotes(1, search, true)
      }
    } catch {
      setResetResult({ ok: false, text: 'Errore di rete' })
    } finally {
      setResetLoading(false)
    }
  }

  const loadVotes = useCallback(async (page: number, searchTerm: string, showLoading = false) => {
    if (showLoading) setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: '25' })
    if (searchTerm) params.append('search', searchTerm)
    const res = await fetch(`/api/admin/votes?${params}${batchParam}`)
    const data = await res.json()
    setSessions(data.data || [])
    setPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
    setLoading(false)
  }, [batchParam])

  // Carica quando cambia il batch effettivo (attivo o scelto dall'admin).
  useEffect(() => {
    if (batchesLoading) return
    loadVotes(1, '', true)
  }, [batchesLoading, effectiveBatch, loadVotes])

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground tracking-tight">Voti</h1>
          <p className="text-[clamp(0.75rem,2.5vw,1rem)] text-muted-foreground">Registro votazioni (3 aziende per sessione)</p>
        </div>
      </header>

      {batches.length > 0 && (
        <BatchFilter
          batches={batches}
          value={effectiveBatch}
          onChange={(v) => { setSearch(''); setSelectedBatch(v) }}
        />
      )}

      {!isViewer && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset dati votazioni
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Cancella definitivamente i voti salvati. Azione irreversibile: i dati rimossi non sono recuperabili.
            </p>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'all'}
                  onChange={() => setResetScope('all')}
                  className="accent-destructive"
                />
                Tutti i voti
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'batch'}
                  onChange={() => setResetScope('batch')}
                  className="accent-destructive"
                />
                Solo batch
              </label>
            </div>

            {resetScope === 'batch' && (
              <div>
                <label className="text-sm font-medium text-foreground">Batch</label>
                <select
                  value={resetBatchEffective}
                  onChange={(e) => setResetBatch(e.target.value)}
                  className="mt-1 w-full sm:w-auto rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {batches.length === 0 && <option value="">Nessun batch disponibile</option>}
                  {batches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.companyCount} aziende · {b.voteCount} voti)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">
                Digita <span className="font-black">RESET</span> per confermare
              </label>
              <input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="RESET"
                className="mt-1 w-full sm:w-64 rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase tracking-widest"
              />
            </div>

            <button
              onClick={handleResetVotes}
              disabled={
                resetLoading ||
                resetConfirm.trim().toUpperCase() !== 'RESET' ||
                (resetScope === 'batch' && !resetBatchEffective)
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
              {resetLoading ? 'Reset in corso…' : 'Resetta voti'}
            </button>

            {resetResult && (
              <p className={`text-sm font-medium ${resetResult.ok ? 'text-emerald-600' : 'text-destructive'}`}>
                {resetResult.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sessione Voti
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Cerca azienda..."
              onChange={(e) => { setSearch(e.target.value); loadVotes(1, e.target.value, true) }}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>

          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nessun voto trovato.</div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="lg:hidden space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-card border border-border rounded-xl shadow-sm p-4">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.timestamp), 'dd/MM/yy HH:mm', { locale: it })} — {s.country}
                    </p>
                    {s.pallets.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-black/5 last:border-b-0">
                        <span className="text-sm font-medium">{p.company}</span>
                        <span className="text-xs font-bold bg-bright px-2 py-0.5 rounded-full">{p.pallet}</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.fingerprint} — {s.device}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black/10 text-left">
                      <th className="p-3 font-black">Data/Ora</th>
                      <th className="p-3 font-black">Azienda 1 (4)</th>
                      <th className="p-3 font-black">Azienda 2 (2)</th>
                      <th className="p-3 font-black">Azienda 3 (1)</th>
                      <th className="p-3 font-black">Fingerprint</th>
                      <th className="p-3 font-black">Paese</th>
                      <th className="p-3 font-black">Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-black/5 hover:bg-gray-50">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(s.timestamp), 'dd/MM/yy HH:mm', { locale: it })}
                        </td>
                        {s.pallets.map((p, i) => (
                          <td key={i} className="p-3">
                            <span className="font-medium">{p.company}</span>
                            <span className="ml-2 text-xs font-bold bg-bright px-1.5 py-0.5 rounded-full">{p.pallet}</span>
                          </td>
                        ))}
                        <td className="p-3 text-xs font-mono text-muted-foreground">{s.fingerprint}</td>
                        <td className="p-3 text-xs text-muted-foreground">{s.country}</td>
                        <td className="p-3 text-xs text-muted-foreground">{s.device}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Pagina {pagination.page} di {pagination.pages} ({pagination.total} totali)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadVotes(pagination.page - 1, search, true)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Precedente
                  </button>
                  <button
                    onClick={() => loadVotes(pagination.page + 1, search, true)}
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
