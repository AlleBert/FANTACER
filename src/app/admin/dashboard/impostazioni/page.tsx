'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings as SettingsIcon, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { AuditCardList } from '@/components/admin/audit-card-list'
import { AuditLogTable } from '@/components/admin/audit-log-table'
import { useAdminRole } from '@/lib/use-admin-role'
import { ModalShell } from '@/components/ui/modal-shell'
import { createClient } from '@/lib/supabase/client'

interface AuditLog {
  id: string
  created_at: string
  event_type: string
  fingerprint: string
  ip_address: string
  metadata: Record<string, unknown>
}

export default function ImpostazioniPage() {
  const role = useAdminRole()
  const isViewer = role === 'viewer'
  const [comingSoonEnabled, setComingSoonEnabled] = useState(false)
  const [votingEnabled, setVotingEnabled] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingValue, setPendingValue] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loadingFlag, setLoadingFlag] = useState(true)
  const [loadingVoting, setLoadingVoting] = useState(true)
  const [showVotingConfirmModal, setShowVotingConfirmModal] = useState(false)
  const [pendingVotingValue, setPendingVotingValue] = useState(false)
  const [updatingVoting, setUpdatingVoting] = useState(false)

  // Audit log state
  const [auditExpanded, setAuditExpanded] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 })
  const [auditSearch, setAuditSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings/coming-soon')
      .then(res => res.json())
      .then(data => setComingSoonEnabled(data.enabled))
      .finally(() => setLoadingFlag(false))

    fetch('/api/admin/settings/voting')
      .then(res => res.json())
      .then(data => setVotingEnabled(data.enabled))
      .finally(() => setLoadingVoting(false))

    const supabase = createClient()
    const channel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        fetch('/api/admin/settings/coming-soon')
          .then(res => res.json())
          .then(data => setComingSoonEnabled(data.enabled))
        fetch('/api/admin/settings/voting')
          .then(res => res.json())
          .then(data => setVotingEnabled(data.enabled))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadAuditLogs = async (page: number, search: string) => {
    const params = new URLSearchParams({ page: page.toString(), limit: '25' })
    if (search) params.append('search', search)
    const res = await fetch(`/api/admin/audit-logs?${params}`)
    const data = await res.json()
    setAuditLogs(data.data || [])
    setAuditPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
  }

  const handleToggle = () => {
    setPendingValue(!comingSoonEnabled)
    setShowConfirmModal(true)
  }

  const confirmToggle = async () => {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/settings/coming-soon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: pendingValue }),
      })
      if (res.ok) setComingSoonEnabled(pendingValue)
    } catch (e) { console.error(e) }
    finally { setUpdating(false); setShowConfirmModal(false) }
  }

  const handleVotingToggle = () => {
    setPendingVotingValue(!votingEnabled)
    setShowVotingConfirmModal(true)
  }

  const confirmVotingToggle = async () => {
    setUpdatingVoting(true)
    try {
      const res = await fetch('/api/admin/settings/voting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: pendingVotingValue }),
      })
      if (res.ok) setVotingEnabled(pendingVotingValue)
    } catch (e) { console.error(e) }
    finally { setUpdatingVoting(false); setShowVotingConfirmModal(false) }
  }

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground tracking-tight">Impostazioni</h1>
          <p className="text-[clamp(0.75rem,2.5vw,1rem)] text-muted-foreground">Gestione sito e sicurezza</p>
        </div>
      </header>

      {/* Coming Soon Toggle */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Impostazioni Sito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-foreground">Coming Soon</p>
              <p className="text-sm text-muted-foreground">
                {comingSoonEnabled
                  ? 'Attivo — il sito mostra la pagina coming-soon'
                  : 'Disattivo — il sito è accessibile normalmente'}
              </p>
            </div>
            {loadingFlag ? (
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            ) : isViewer ? (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                comingSoonEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {comingSoonEnabled ? 'Attivo' : 'Disattivo'}
              </span>
            ) : (
              <button onClick={handleToggle} disabled={updating}
                className={`relative h-9 w-14 rounded-full transition-colors disabled:opacity-50 ${
                  comingSoonEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                <span className={`absolute left-0.5 top-0.5 h-8 w-8 rounded-full bg-white transition-transform ${
                  comingSoonEnabled ? 'translate-x-5' : ''
                }`} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4 mt-4">
            <div>
              <p className="font-medium text-foreground">Votazioni</p>
              <p className="text-sm text-muted-foreground">
                {votingEnabled
                  ? 'Attivo — gli utenti possono votare le aziende'
                  : 'Disattivo — mostra messaggio "Ci vediamo al Cersaie"'}
              </p>
            </div>
            {loadingVoting ? (
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            ) : isViewer ? (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                votingEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {votingEnabled ? 'Attivo' : 'Disattivo'}
              </span>
            ) : (
              <button onClick={handleVotingToggle} disabled={updatingVoting}
                className={`relative h-9 w-14 rounded-full transition-colors disabled:opacity-50 ${
                  votingEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                <span className={`absolute left-0.5 top-0.5 h-8 w-8 rounded-full bg-white transition-transform ${
                  votingEnabled ? 'translate-x-5' : ''
                }`} />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log collapsible section */}
      <Card className="border-border">
        <CardHeader className="pb-4 cursor-pointer select-none"
          onClick={() => {
            setAuditExpanded(!auditExpanded)
            if (!auditExpanded && auditLogs.length === 0) loadAuditLogs(1, '')
          }}>
          <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Log
            </span>
            {auditExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
              : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {auditExpanded && (
          <CardContent className="p-4 md:p-6 border-t border-border">
            <div className="lg:hidden">
              <AuditCardList data={auditLogs} pagination={auditPagination}
                onPageChange={(p: number) => loadAuditLogs(p, auditSearch)}
                onSearch={(s: string) => { setAuditSearch(s); loadAuditLogs(1, s) }} />
            </div>
            <div className="hidden lg:block">
              <AuditLogTable data={auditLogs} pagination={auditPagination}
                onPageChange={(p: number) => loadAuditLogs(p, auditSearch)}
                onSearch={(s: string) => { setAuditSearch(s); loadAuditLogs(1, s) }} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Confirm modal */}
      <ModalShell
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        labelledBy="impostazioni-confirm-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-md"
      >
        <h3 id="impostazioni-confirm-title" className="text-lg font-semibold text-foreground">
          {pendingValue ? 'Attivare coming-soon?' : 'Disattivare coming-soon?'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {pendingValue
            ? 'Tutti gli utenti verranno reindirizzati alla pagina coming-soon. Le API rimarranno accessibili.'
            : 'Il sito tornerà accessibile a tutti gli utenti.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowConfirmModal(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            disabled={updating}>Annulla</button>
          <button onClick={confirmToggle} disabled={updating}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              pendingValue ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            }`}>
            {updating ? 'Aggiornamento...' : 'Conferma'}
          </button>
        </div>
      </ModalShell>

      {/* Voting confirm modal */}
      <ModalShell
        open={showVotingConfirmModal}
        onClose={() => setShowVotingConfirmModal(false)}
        labelledBy="voting-confirm-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-md"
      >
        <h3 id="voting-confirm-title" className="text-lg font-semibold text-foreground">
          {pendingVotingValue ? 'Attivare votazioni?' : 'Disattivare votazioni?'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {pendingVotingValue
            ? 'Gli utenti potranno votare le aziende e vedere la classifica live.'
            : 'Votazioni e classifica verranno sostituite dal messaggio "Ci vediamo al Cersaie".'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowVotingConfirmModal(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            disabled={updatingVoting}>Annulla</button>
          <button onClick={confirmVotingToggle} disabled={updatingVoting}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              pendingVotingValue ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90'
            }`}>
            {updatingVoting ? 'Aggiornamento...' : 'Conferma'}
          </button>
        </div>
      </ModalShell>
    </div>
  )
}
