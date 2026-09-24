'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Building2, ChevronDown, ChevronUp, DatabaseBackup, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ModalShell } from '@/components/ui/modal-shell'
import { useBatches } from '@/hooks/use-batches'
import { useAdminRole } from '@/lib/use-admin-role'
import type { ProjectionResult, RankingRow } from '@/lib/company-admin-projection'

interface Company {
  id: string
  name: string
  blocked: boolean
  manualScore: boolean
}

type ActionKey = 'delete-votes' | 'block' | 'unblock' | 'set-score' | 'clear-score'
type UnblockMode = 'keep' | 'zero' | 'custom'

interface ActionPayload {
  companyIds: string[]
  deleteVotes?: boolean
  blocked?: boolean
  score?: { pallets: number; votes: number } | null
}

export function buildActionPayload(
  companyIds: string[],
  action: ActionKey,
  opts: { pallets: number; votes: number; unblockMode: UnblockMode },
): ActionPayload {
  switch (action) {
    case 'delete-votes':
      return { companyIds, deleteVotes: true }
    case 'block':
      return { companyIds, blocked: true }
    case 'clear-score':
      return { companyIds, score: null }
    case 'set-score':
      return { companyIds, score: { pallets: opts.pallets, votes: opts.votes } }
    case 'unblock':
      if (opts.unblockMode === 'keep') return { companyIds, blocked: false }
      return {
        companyIds,
        blocked: false,
        score:
          opts.unblockMode === 'zero'
            ? { pallets: 0, votes: 0 }
            : { pallets: opts.pallets, votes: opts.votes },
      }
  }
}

function formatBackupDate(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

const ACTION_LABELS: Record<ActionKey, string> = {
  'delete-votes': 'Cancella voti',
  block: 'Escludi e blocca',
  unblock: 'Sblocca / ripristina',
  'set-score': 'Imposta punteggio manuale',
  'clear-score': 'Rimuovi punteggio manuale',
}

function RankingPreview({ title, rows, selected }: { title: string; rows: RankingRow[]; selected: Set<string> }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ol className="space-y-1 text-sm">
        {rows.slice(0, 12).map((r) => (
          <li
            key={r.id}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
              selected.has(r.id) ? 'bg-primary/10 font-medium' : ''
            }`}
          >
            <span className="truncate">
              <span className="mr-2 font-mono text-xs text-muted-foreground">{r.rank}</span>
              {r.name}
            </span>
            <span className="font-mono text-xs">{r.pallets}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function CompanyActionsCard() {
  const role = useAdminRole()
  const isViewer = role === 'viewer'
  const { activeBatch, loading: batchesLoading } = useBatches()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [action, setAction] = useState<ActionKey>('delete-votes')
  const [unblockMode, setUnblockMode] = useState<UnblockMode>('keep')
  const [pallets, setPallets] = useState('0')
  const [votes, setVotes] = useState('0')
  const [preview, setPreview] = useState<ProjectionResult | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [backups, setBackups] = useState<
    { id: number; created_at: string; label: string | null; batch: string | null; company_ids: string[] | null }[]
  >([])
  const [backupsOpen, setBackupsOpen] = useState(false)
  const [backupsLoaded, setBackupsLoaded] = useState(false)
  const [expandedBackup, setExpandedBackup] = useState<number | null>(null)
  const [backupDetail, setBackupDetail] = useState<Record<string, unknown> | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const qs = activeBatch ? `?batch=${encodeURIComponent(activeBatch)}` : ''
      const res = await fetch(`/api/admin/companies${qs}`)
      const data = await res.json()
      setCompanies(
        (data.data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          blocked: c.blocked === true,
          manualScore: c.manualScore === true,
        })),
      )
    } catch {
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [activeBatch])

  useEffect(() => {
    if (batchesLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati quando cambia il batch
    void loadCompanies()
  }, [batchesLoading, loadCompanies])

  const loadBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/companies/backup')
      const data = await res.json()
      setBackups(data.data ?? [])
    } catch {
      setBackups([])
    } finally {
      setBackupsLoaded(true)
    }
  }, [])

  const toggleBackups = () => {
    const next = !backupsOpen
    setBackupsOpen(next)
    if (next && !backupsLoaded) void loadBackups()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies
  }, [companies, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setPreview(null)
  }

  const payload = buildActionPayload([...selected], action, {
    pallets: Number(pallets) || 0,
    votes: Number(votes) || 0,
    unblockMode,
  })

  const requestPreview = async () => {
    if (selected.size === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/companies/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Errore nella preview')
        return
      }
      setPreview(data as ProjectionResult)
      setPreviewOpen(true)
    } finally {
      setBusy(false)
    }
  }

  const confirmApply = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/companies/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Errore applicazione')
        return
      }
      setMessage('Azione applicata. Backup di stato creato.')
      setPreviewOpen(false)
      setPreview(null)
      setSelected(new Set())
      await loadCompanies()
    } finally {
      setBusy(false)
    }
  }

  const createBackup = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/companies/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: selected.size > 0 ? `backup ${selected.size} aziende` : 'backup batch attivo',
          companyIds: [...selected],
        }),
      })
      const data = await res.json()
      setMessage(res.ok ? `Backup creato (#${data.backup?.backup_id ?? '?'}).` : data.error)
      if (res.ok) await loadBackups()
    } finally {
      setBusy(false)
    }
  }

  const openBackupDetail = async (id: number) => {
    if (expandedBackup === id) {
      setExpandedBackup(null)
      setBackupDetail(null)
      return
    }
    setExpandedBackup(id)
    setBackupDetail(null)
    try {
      const res = await fetch(`/api/admin/companies/backup?id=${id}`)
      const data = await res.json()
      setBackupDetail(data.data ?? null)
    } catch {
      setBackupDetail(null)
    }
  }

  const downloadBackup = async (id: number) => {
    let detail = expandedBackup === id ? backupDetail : null
    if (!detail) {
      try {
        const res = await fetch(`/api/admin/companies/backup?id=${id}`)
        const data = await res.json()
        detail = data.data ?? null
      } catch {
        detail = null
      }
    }
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `backup-${id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const confirmRestore = async () => {
    if (restoreTarget == null) return
    setRestoring(true)
    try {
      const res = await fetch('/api/admin/companies/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreBackupId: restoreTarget }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Errore ripristino')
        return
      }
      setMessage('Backup ripristinato.')
      setRestoreTarget(null)
      await loadBackups()
      await loadCompanies()
    } finally {
      setRestoring(false)
    }
  }

  const restoreCount = backups.find((b) => b.id === restoreTarget)?.company_ids?.length ?? 0

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Gestione aziende
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Seleziona una o più aziende e applica un&apos;azione. Prima di ogni conferma viene mostrata
          l&apos;anteprima della classifica e viene salvato un backup dello stato.
        </p>

        {!isViewer && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
            <label className="flex flex-col gap-1 text-sm">
              Azione
              <select
                aria-label="Azione"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value as ActionKey)
                  setPreview(null)
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {(Object.keys(ACTION_LABELS) as ActionKey[]).map((k) => (
                  <option key={k} value={k}>
                    {ACTION_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            {action === 'unblock' && (
              <label className="flex flex-col gap-1 text-sm">
                Ripristino voti
                <select
                  aria-label="Ripristino voti"
                  value={unblockMode}
                  onChange={(e) => setUnblockMode(e.target.value as UnblockMode)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="keep">Mantieni voti attuali</option>
                  <option value="zero">Riparti da 0</option>
                  <option value="custom">Riparti da N</option>
                </select>
              </label>
            )}

            {((action === 'set-score') || (action === 'unblock' && unblockMode === 'custom')) && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Punti (pallet)
                  <Input
                    aria-label="Punti"
                    type="number"
                    value={pallets}
                    onChange={(e) => setPallets(e.target.value)}
                    className="w-28"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Voti
                  <Input
                    aria-label="Voti"
                    type="number"
                    value={votes}
                    onChange={(e) => setVotes(e.target.value)}
                    className="w-28"
                  />
                </label>
              </>
            )}

            <button
              type="button"
              onClick={requestPreview}
              disabled={busy || selected.size === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Anteprima
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Cerca azienda"
            placeholder="Cerca azienda"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Caricamento…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nessuna azienda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  {!isViewer && (
                    <input
                      type="checkbox"
                      aria-label={`Seleziona ${c.name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4"
                    />
                  )}
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  {c.blocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      <Ban className="h-3 w-3" /> bloccata
                    </span>
                  )}
                  {c.manualScore && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      punteggio manuale
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={toggleBackups}
            aria-expanded={backupsOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4" />
              Backup
            </span>
            {backupsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {backupsOpen && (
            <div className="space-y-3 border-t border-border p-3">
              {!isViewer && (
                <button
                  type="button"
                  onClick={createBackup}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  <DatabaseBackup className="h-4 w-4" />
                  Backup situazione
                </button>
              )}

              {!backupsLoaded ? (
                <p className="text-sm text-muted-foreground">Caricamento…</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun backup.</p>
              ) : (
                <ul className="space-y-2">
                  {backups.map((b) => (
                    <li key={b.id} className="rounded-md border border-border p-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatBackupDate(b.created_at)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{b.label ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">{b.batch ?? '—'}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.company_ids?.length ?? 0} aziende
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openBackupDetail(b.id)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Dettagli
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadBackup(b.id)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Download JSON
                        </button>
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={() => setRestoreTarget(b.id)}
                            className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            Ripristina
                          </button>
                        )}
                      </div>
                      {expandedBackup === b.id && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-secondary p-2 text-xs">
                          {backupDetail
                            ? JSON.stringify(
                                (backupDetail as { payload?: unknown }).payload ?? backupDetail,
                                null,
                                2,
                              )
                            : 'Caricamento…'}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>

      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        labelledBy="company-action-preview-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-2xl"
      >
        <h3 id="company-action-preview-title" className="text-lg font-semibold text-foreground">
          Anteprima: {ACTION_LABELS[action]}
        </h3>
        {preview && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {preview.impact.selected.length} aziende selezionate · schede coinvolte da cancellare:{' '}
              {preview.impact.sessionsDeleted}
            </p>
            <div className="mt-4 flex gap-4">
              <RankingPreview title="Prima" rows={preview.before} selected={selected} />
              <RankingPreview title="Dopo" rows={preview.after} selected={selected} />
            </div>
          </>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Annulla
          </button>
          <button
            type="button"
            aria-label="Conferma"
            onClick={confirmApply}
            disabled={busy}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? 'Applicazione…' : 'Conferma'}
          </button>
        </div>
      </ModalShell>

      <ModalShell
        open={restoreTarget != null}
        onClose={() => setRestoreTarget(null)}
        labelledBy="company-backup-restore-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-md"
      >
        <h3 id="company-backup-restore-title" className="text-lg font-semibold text-foreground">
          Ripristinare questo backup?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Verranno riapplicati blocco e punteggi salvati alle {restoreCount} aziende del backup (i
          voti non vengono toccati).
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setRestoreTarget(null)}
            disabled={restoring}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Annulla
          </button>
          <button
            type="button"
            aria-label="Conferma"
            onClick={confirmRestore}
            disabled={restoring}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {restoring ? 'Ripristino…' : 'Conferma'}
          </button>
        </div>
      </ModalShell>
    </Card>
  )
}
