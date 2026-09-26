'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAdminRole } from '@/lib/use-admin-role'

type IdentityMode = 'off' | 'shadow' | 'dual' | 'session'

interface NoncesSummary {
  total: number
  consumed: number
  expired: number
  outstanding: number
  suspiciousOutstanding: boolean
}

interface SectionError {
  error: string
}

type TotalsDrift = { drift: number; aligned: boolean }
type VoteHealth = { ok: boolean; kind: 'json' | 'html' | 'other' }

interface StatusResponse {
  identityMode: IdentityMode
  nonces: NoncesSummary | SectionError
  totalsDrift: TotalsDrift | SectionError
  voteHealth: VoteHealth
}

const IDENTITY_LABEL: Record<IdentityMode, string> = {
  off: 'off',
  shadow: 'shadow',
  dual: 'dual',
  session: 'session',
}

const IDENTITY_EXPLANATION: Record<IdentityMode, string> = {
  off: 'Identità server disattivata: comportamento legacy.',
  shadow: 'Dual-write in ombra: scrive il principal senza cambiare la lettura.',
  dual: 'Dual-read: legge la sessione con fallback legacy.',
  session: 'Cutover: lettura solo dalla sessione server.',
}

const IDENTITY_BADGE_CLASS: Record<IdentityMode, string> = {
  off: 'bg-muted text-muted-foreground',
  shadow: 'bg-primary/10 text-primary',
  dual: 'bg-amber-500/10 text-amber-600',
  session: 'bg-emerald-500/10 text-emerald-600',
}

function isSectionError(value: unknown): value is SectionError {
  return typeof value === 'object' && value !== null && 'error' in value
}

function healthLabel(health: VoteHealth): string {
  if (health.ok) return 'OK (JSON)'
  if (health.kind === 'html') return 'Anomalia (HTML)'
  if (health.kind === 'json') return 'Anomalia (JSON 5xx)'
  return 'Anomalia (nessuna risposta JSON)'
}

export function SecurityStatusCard() {
  const role = useAdminRole()
  const isViewer = role === 'viewer'

  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/security/status')
      const body = await res.json()
      if (!res.ok) {
        setError(
          (body as { error?: string }).error ?? 'Errore nel caricamento dello stato sicurezza',
        )
        return
      }
      setData(body as StatusResponse)
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

  const nonces = data && !isSectionError(data.nonces) ? data.nonces : null
  const noncesError = data && isSectionError(data.nonces) ? data.nonces : null
  const drift = data && !isSectionError(data.totalsDrift) ? data.totalsDrift : null
  const driftError = data && isSectionError(data.totalsDrift) ? data.totalsDrift : null

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Stato sicurezza
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Diagnostica read-only delle difese del voto.
          {isViewer ? ' Modalità sola lettura.' : ''}
        </p>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Modalità identità</p>
                <span
                  data-testid="identity-mode"
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    IDENTITY_BADGE_CLASS[data.identityMode]
                  }`}
                >
                  {IDENTITY_LABEL[data.identityMode]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {IDENTITY_EXPLANATION[data.identityMode]}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Drift totali classifica</p>
                {drift ? (
                  <span
                    data-testid="drift-badge"
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                      drift.aligned
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {drift.aligned ? 'Allineati' : `Divergenti (Δ ${drift.drift})`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              {driftError ? (
                <p className="mt-1 text-xs text-muted-foreground">Drift totali non disponibile.</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Se divergente, usa «Riconcilia totali» nella pagina Voti.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">Salute voto</p>
                <span
                  data-testid="vote-health-badge"
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    data.voteHealth.ok
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {!data.voteHealth.ok && <AlertTriangle className="h-3.5 w-3.5" />}
                  {healthLabel(data.voteHealth)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Probe su /api/vota: JSON atteso, HTML indica un redirect o un errore.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">Nonce di bootstrap</p>
              {noncesError ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Conteggio nonce non disponibile.
                </p>
              ) : nonces ? (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Totali</p>
                      <p data-testid="nonces-total" className="text-lg font-bold text-foreground">
                        {nonces.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Consumati</p>
                      <p
                        data-testid="nonces-consumed"
                        className="text-lg font-bold text-foreground"
                      >
                        {nonces.consumed}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Scaduti</p>
                      <p data-testid="nonces-expired" className="text-lg font-bold text-foreground">
                        {nonces.expired}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">In sospeso</p>
                      <p
                        data-testid="nonces-outstanding"
                        className="text-lg font-bold text-foreground"
                      >
                        {nonces.outstanding}
                      </p>
                    </div>
                  </div>
                  {nonces.suspiciousOutstanding && (
                    <p
                      data-testid="nonces-warning"
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-destructive"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Outstanding anomalo: verifica i nonce non consumati.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Ricarica
        </button>
      </CardContent>
    </Card>
  )
}
