'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings as SettingsIcon, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { AuditCardList } from '@/components/admin/audit-card-list'
import { AuditLogTable } from '@/components/admin/audit-log-table'
import { CompanyActionsCard } from '@/components/admin/company-actions-card'
import { SecurityStatusCard } from '@/components/admin/security-status-card'
import { useAdminRole } from '@/lib/use-admin-role'
import { ModalShell } from '@/components/ui/modal-shell'
import { createClient } from '@/lib/supabase/client'
import { safeSubscribe } from '@/lib/supabase/realtime'

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
  const [antibotEnabled, setAntibotEnabled] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingValue, setPendingValue] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loadingFlag, setLoadingFlag] = useState(true)
  const [loadingVoting, setLoadingVoting] = useState(true)
  const [showVotingConfirmModal, setShowVotingConfirmModal] = useState(false)
  const [pendingVotingValue, setPendingVotingValue] = useState(false)
  const [updatingVoting, setUpdatingVoting] = useState(false)
  const [loadingAntibot, setLoadingAntibot] = useState(true)
  const [showAntibotConfirmModal, setShowAntibotConfirmModal] = useState(false)
  const [pendingAntibotValue, setPendingAntibotValue] = useState(false)
  const [updatingAntibot, setUpdatingAntibot] = useState(false)
  const [fairEndEnabled, setFairEndEnabled] = useState(false)
  const [fairEndRevealTime, setFairEndRevealTime] = useState('12:30')
  const [fairEndCeremony, setFairEndCeremony] = useState<{ '1': string; '2': string; '3': string }>({ '1': '14:00', '2': '13:45', '3': '13:30' })
  const [loadingFairEnd, setLoadingFairEnd] = useState(true)
  const [showFairEndConfirmModal, setShowFairEndConfirmModal] = useState(false)
  const [pendingFairEndValue, setPendingFairEndValue] = useState(false)
  const [updatingFairEnd, setUpdatingFairEnd] = useState(false)

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

    fetch('/api/admin/settings/antibot')
      .then(res => res.json())
      .then(data => setAntibotEnabled(data.enabled))
      .finally(() => setLoadingAntibot(false))

    const loadFairEnd = () =>
      fetch('/api/admin/settings/fair-end')
        .then(res => res.json())
        .then(data => {
          setFairEndEnabled(!!data.enabled)
          if (typeof data.revealTime === 'string') setFairEndRevealTime(data.revealTime)
          if (data.ceremony) setFairEndCeremony(data.ceremony)
        })
        .finally(() => setLoadingFairEnd(false))
    loadFairEnd()

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
        fetch('/api/admin/settings/antibot')
          .then(res => res.json())
          .then(data => setAntibotEnabled(data.enabled))
        loadFairEnd()
      })
    safeSubscribe(channel)

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

  const handleAntibotToggle = () => {
    setPendingAntibotValue(!antibotEnabled)
    setShowAntibotConfirmModal(true)
  }

  const confirmAntibotToggle = async () => {
    setUpdatingAntibot(true)
    try {
      const res = await fetch('/api/admin/settings/antibot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: pendingAntibotValue }),
      })
      if (res.ok) setAntibotEnabled(pendingAntibotValue)
    } catch (e) { console.error(e) }
    finally { setUpdatingAntibot(false); setShowAntibotConfirmModal(false) }
  }

  const handleFairEndToggle = () => {
    setPendingFairEndValue(!fairEndEnabled)
    setShowFairEndConfirmModal(true)
  }

  const saveFairEnd = async (enabled: boolean) => {
    setUpdatingFairEnd(true)
    try {
      const res = await fetch('/api/admin/settings/fair-end', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, revealTime: fairEndRevealTime, ceremony: fairEndCeremony }),
      })
      if (res.ok) setFairEndEnabled(enabled)
    } catch (e) { console.error(e) }
    finally { setUpdatingFairEnd(false); setShowFairEndConfirmModal(false) }
  }

  const confirmFairEndToggle = () => saveFairEnd(pendingFairEndValue)

  const handleSaveFairEndTimes = async () => {
    setUpdatingFairEnd(true)
    try {
      const res = await fetch('/api/admin/settings/fair-end', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: fairEndEnabled, revealTime: fairEndRevealTime, ceremony: fairEndCeremony }),
      })
      if (!res.ok) console.error('Errore salvataggio orari Fine Fiera')
    } catch (e) { console.error(e) }
    finally { setUpdatingFairEnd(false) }
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

          <div className="flex items-center justify-between rounded-lg border border-border p-4 mt-4">
            <div>
              <p className="font-medium text-foreground">Anti-bot</p>
              <p className="text-sm text-muted-foreground">
                {antibotEnabled
                  ? 'Attivo — voto sospeso e classifica live nascosta su tutti i dispositivi'
                  : 'Disattivo — nessun blocco automatico'}
              </p>
            </div>
            {loadingAntibot ? (
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            ) : isViewer ? (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                antibotEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {antibotEnabled ? 'Attivo' : 'Disattivo'}
              </span>
            ) : (
              <button onClick={handleAntibotToggle} disabled={updatingAntibot}
                className={`relative h-9 w-14 rounded-full transition-colors disabled:opacity-50 ${
                  antibotEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                <span className={`absolute left-0.5 top-0.5 h-8 w-8 rounded-full bg-white transition-transform ${
                  antibotEnabled ? 'translate-x-5' : ''
                }`} />
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Fine Fiera</p>
                <p className="text-sm text-muted-foreground">
                  {fairEndEnabled
                    ? 'Attivo — voti chiusi e card finale nella sezione voto'
                    : 'Disattivo — votazioni normali'}
                </p>
              </div>
              {loadingFairEnd ? (
                <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
              ) : isViewer ? (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                  fairEndEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {fairEndEnabled ? 'Attivo' : 'Disattivo'}
                </span>
              ) : (
                <button onClick={handleFairEndToggle} disabled={updatingFairEnd}
                  className={`relative h-9 w-14 rounded-full transition-colors disabled:opacity-50 ${
                    fairEndEnabled ? 'bg-primary' : 'bg-muted'
                  }`}>
                  <span className={`absolute left-0.5 top-0.5 h-8 w-8 rounded-full bg-white transition-transform ${
                    fairEndEnabled ? 'translate-x-5' : ''
                  }`} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Orario rivelazione
                <input type="time" value={fairEndRevealTime} disabled={isViewer}
                  onChange={(e) => setFairEndRevealTime(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Premiazione 1°
                <input type="time" value={fairEndCeremony['1']} disabled={isViewer}
                  onChange={(e) => setFairEndCeremony((c) => ({ ...c, '1': e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Premiazione 2°
                <input type="time" value={fairEndCeremony['2']} disabled={isViewer}
                  onChange={(e) => setFairEndCeremony((c) => ({ ...c, '2': e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Premiazione 3°
                <input type="time" value={fairEndCeremony['3']} disabled={isViewer}
                  onChange={(e) => setFairEndCeremony((c) => ({ ...c, '3': e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-60" />
              </label>
            </div>

            {!isViewer && (
              <button onClick={handleSaveFairEndTimes} disabled={updatingFairEnd}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">
                {updatingFairEnd ? 'Salvataggio...' : 'Salva orari'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company actions: block / unblock / delete votes / manual score */}
      <CompanyActionsCard />

      {/* Read-only security surface: identity mode, nonces, drift, vote health */}
      <SecurityStatusCard />

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

      {/* Antibot confirm modal */}
      <ModalShell
        open={showAntibotConfirmModal}
        onClose={() => setShowAntibotConfirmModal(false)}
        labelledBy="antibot-confirm-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-md"
      >
        <h3 id="antibot-confirm-title" className="text-lg font-semibold text-foreground">
          {pendingAntibotValue ? 'Attivare l\'anti-bot?' : 'Disattivare l\'anti-bot?'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {pendingAntibotValue
            ? 'Il voto verrà sospeso e la classifica live nascosta su tutti i dispositivi, con il messaggio "Voto sospeso".'
            : 'Voto e classifica live torneranno immediatamente disponibili.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowAntibotConfirmModal(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            disabled={updatingAntibot}>Annulla</button>
          <button onClick={confirmAntibotToggle} disabled={updatingAntibot}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              pendingAntibotValue ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            }`}>
            {updatingAntibot ? 'Aggiornamento...' : 'Conferma'}
          </button>
        </div>
      </ModalShell>

      {/* Fair end confirm modal */}
      <ModalShell
        open={showFairEndConfirmModal}
        onClose={() => setShowFairEndConfirmModal(false)}
        labelledBy="fair-end-confirm-title"
        className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-md"
      >
        <h3 id="fair-end-confirm-title" className="text-lg font-semibold text-foreground">
          {pendingFairEndValue ? 'Attivare FINE FIERA?' : 'Disattivare FINE FIERA?'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {pendingFairEndValue
            ? `Voti chiusi e card finale nella sezione voto. La classifica si svela alle ${fairEndRevealTime}.`
            : 'Votazioni e card tornano normali.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowFairEndConfirmModal(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            disabled={updatingFairEnd}>Annulla</button>
          <button onClick={confirmFairEndToggle} disabled={updatingFairEnd}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              pendingFairEndValue ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            }`}>
            {updatingFairEnd ? 'Aggiornamento...' : 'Conferma'}
          </button>
        </div>
      </ModalShell>
    </div>
  )
}
