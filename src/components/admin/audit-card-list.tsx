'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Search, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AuditLog {
  id: string
  created_at: string
  event_type: string
  fingerprint: string
  ip_address: string
  metadata: any
}

interface AuditCardListProps {
  data: AuditLog[]
  pagination: { page: number; limit: number; total: number; pages: number }
  onPageChange: (page: number) => void
  onSearch: (search: string) => void
}

export function AuditCardList({ data, pagination, onPageChange, onSearch }: AuditCardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca per evento o fingerprint..." onChange={(e) => onSearch(e.target.value)}
          className="pl-9 bg-background border-border text-foreground h-10" />
      </div>

      <div className="space-y-3">
        {data.map((log) => {
          const isSecurity = log.event_type.includes('block') || log.event_type.includes('fraud') || log.event_type.includes('fail')
          return (
            <div key={log.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 p-4 cursor-pointer active:bg-secondary/30 transition-colors"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                {isSecurity && <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isSecurity ? 'text-red-500' : 'text-foreground'}`}>
                      {log.event_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: it })}
                  </p>
                </div>
                <div className="shrink-0 mt-1 text-muted-foreground">
                  {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {expandedId === log.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Fingerprint</span>
                      <code className="text-xs font-mono">{log.fingerprint?.substring(0, 12)}</code>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">IP</span>
                      <code className="text-xs font-mono">{log.ip_address || '—'}</code>
                    </div>
                    {log.metadata && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground block mb-1">Dettagli</span>
                        <pre className="text-[11px] bg-muted/50 p-2 rounded-lg overflow-auto max-h-32 font-mono">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {data.length === 0 && (
          <p className="text-center text-muted-foreground py-8 italic">
            Nessun log trovato
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Pagina {pagination.page} di {pagination.pages} ({pagination.total} log)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1} className="h-10 border-border">Precedente</Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages} className="h-10 border-border">Successivo</Button>
        </div>
      </div>
    </div>
  )
}
