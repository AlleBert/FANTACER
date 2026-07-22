'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings as SettingsIcon, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { AuditCardList } from '@/components/admin/audit-card-list'
import { AuditLogTable } from '@/components/admin/audit-log-table'

interface AuditLog {
  id: string
  created_at: string
  event_type: string
  fingerprint: string
  ip_address: string
  metadata: Record<string, unknown>
}

export default function ImpostazioniPage() {
  const [comingSoonEnabled, setComingSoonEnabled] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingValue, setPendingValue] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loadingFlag, setLoadingFlag] = useState(true)

  // Audit log state
  const [auditExpanded, setAuditExpanded] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 })
  const [auditSearch, setAuditSearch] = useState('')

  useEffect(() => {
    const session = localStorage.getItem('admin_session')
    fetch('/api/admin/settings/coming-soon', {
      headers: session ? { Authorization: `Bearer ${session}` } : {},
    })
      .then(res => res.json())
      .then(data => setComingSoonEnabled(data.enabled))
      .finally(() => setLoadingFlag(false))
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
      const session = localStorage.getItem('admin_session')
      const res = await fetch('/api/admin/settings/coming-soon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify({ enabled: pendingValue }),
      })
      if (res.ok) setComingSoonEnabled(pendingValue)
    } catch (e) { console.error(e) }
    finally { setUpdating(false); setShowConfirmModal(false) }
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
            <div className="md:hidden">
              <AuditCardList data={auditLogs} pagination={auditPagination}
                onPageChange={(p: number) => loadAuditLogs(p, auditSearch)}
                onSearch={(s: string) => { setAuditSearch(s); loadAuditLogs(1, s) }} />
            </div>
            <div className="hidden md:block">
              <AuditLogTable data={auditLogs} pagination={auditPagination}
                onPageChange={(p: number) => loadAuditLogs(p, auditSearch)}
                onSearch={(s: string) => { setAuditSearch(s); loadAuditLogs(1, s) }} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
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
          </div>
        </div>
      )}
    </div>
  )
}
