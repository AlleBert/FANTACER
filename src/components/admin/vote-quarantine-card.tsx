'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAdminRole } from '@/lib/use-admin-role'

interface QuarantineCounts {
  accepted: number
  quarantined: number
  rejected: number
  total: number
}

interface QuarantineVote {
  id: string
  createdAt: string | null
  status: string
  fingerprint: string | null
  country: string | null
  reviewActor: string | null
  reviewedAt: string | null
  reviewReason: string | null
  riskFindings: Record<string, unknown> | null
}

interface QuarantineResponse {
  counts?: Partial<QuarantineCounts>
  votes?: QuarantineVote[]
}

const EMPTY_COUNTS: QuarantineCounts = {
  accepted: 0,
  quarantined: 0,
  rejected: 0,
  total: 0,
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd/MM/yy HH:mm', { locale: it })
}

function riskSummary(findings: Record<string, unknown> | null): string | null {
  if (!findings) return null
  const keys = Object.keys(findings)
  if (keys.length === 0) return null
  return keys.join(', ')
}

export function VoteQuarantineCard() {
  const role = useAdminRole()
  const isViewer = role === 'viewer'

  const [counts, setCounts] = useState<QuarantineCounts>(EMPTY_COUNTS)
  const [votes, setVotes] = useState<QuarantineVote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reconciling, setReconciling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/votes/quarantine')
      const data: QuarantineResponse = await res.json()
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ?? 'Errore nel caricamento della quarantena',
        )
        return
      }
      setCounts({ ...EMPTY_COUNTS, ...(data.counts ?? {}) })
      setVotes(data.votes ?? [])
    } catch {
      setError('Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch iniziale
    void load()
  }, [load])

  const review = async (id: string, status: 'accepted' | 'rejected') => {
    setBusyId(id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/votes/quarantine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteId: id, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Errore nella revisione del voto')
        return
      }
      setMessage(status === 'accepted' ? 'Voto accettato.' : 'Voto rifiutato.')
      await load()
    } catch {
      setError('Errore di rete')
    } finally {
      setBusyId(null)
    }
  }

  const reconcile = async () => {
    setReconciling(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/votes/reconcile', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Errore nella riconciliazione dei totali')
        return
      }
      setMessage(
        data.changed
          ? `Totali riconciliati (${data.companies_changed ?? 0} aziende).`
          : 'Totali già allineati.',
      )
      await load()
    } catch {
      setError('Errore di rete')
    } finally {
      setReconciling(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Quarantena voti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Voti sospesi o respinti (esclusi da classifica e totali). Accetta o rifiuta per
          aggiornare lo stato.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Accettati</p>
            <p data-testid="count-accepted" className="text-xl font-bold text-foreground">
              {counts.accepted}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">In quarantena</p>
            <p data-testid="count-quarantined" className="text-xl font-bold text-amber-600">
              {counts.quarantined}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Respinti</p>
            <p data-testid="count-rejected" className="text-xl font-bold text-destructive">
              {counts.rejected}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Totale</p>
            <p data-testid="count-total" className="text-xl font-bold text-foreground">
              {counts.total}
            </p>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : votes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun voto in quarantena o respinto.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {votes.map((vote) => {
              const findings = riskSummary(vote.riskFindings)
              return (
                <li key={vote.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">#{vote.id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        vote.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {vote.status === 'rejected' ? 'Respinto' : 'In quarantena'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(vote.createdAt)}
                    </span>
                    {vote.country && (
                      <span className="text-xs text-muted-foreground">{vote.country}</span>
                    )}
                    {vote.fingerprint && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {vote.fingerprint}…
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-foreground">
                    Motivo: <span>{vote.reviewReason ?? '—'}</span>
                  </p>
                  {findings && (
                    <p className="text-xs text-muted-foreground">Segnali: {findings}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void review(vote.id, 'accepted')}
                      disabled={isViewer || busyId === vote.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accetta
                    </button>
                    <button
                      type="button"
                      onClick={() => void review(vote.id, 'rejected')}
                      disabled={isViewer || busyId === vote.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rifiuta
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void reconcile()}
          disabled={isViewer || reconciling}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} />
          {reconciling ? 'Riconciliazione…' : 'Riconcilia totali'}
        </button>
      </CardContent>
    </Card>
  )
}
