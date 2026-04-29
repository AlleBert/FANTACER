'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Search, ShieldAlert, ArrowUpDown, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AuditLog {
  id: string
  created_at: string
  event_type: string
  fingerprint: string
  ip_address: string
  metadata: any
}

const columnHelper = createColumnHelper<AuditLog>()

const columns = [
  columnHelper.accessor('created_at', {
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 text-foreground"
      >
        Data/Ora
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => (
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {format(new Date(info.getValue()), 'dd/MM/yy HH:mm', { locale: it })}
      </span>
    ),
    size: 130,
  }),
  columnHelper.accessor('event_type', {
    header: 'Evento',
    cell: info => {
      const type = info.getValue()
      const isSecurity = type.includes('block') || type.includes('fraud') || type.includes('fail')
      return (
        <div className="flex items-center gap-2">
          {isSecurity && <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />}
          <span className={`font-medium text-xs truncate max-w-[150px] ${isSecurity ? 'text-red-500' : 'text-foreground'}`}>
            {type}
          </span>
        </div>
      )
    },
  }),
  columnHelper.accessor('fingerprint', {
    header: 'ID',
    cell: info => <code className="text-[10px] text-muted-foreground">{info.getValue()?.substring(0, 8)}</code>,
    size: 80,
  }),
  columnHelper.accessor('ip_address', {
    header: 'IP',
    cell: info => <span className="text-muted-foreground text-[10px] font-mono">{info.getValue() || '--'}</span>,
    size: 100,
  }),
  columnHelper.accessor('metadata', {
    header: 'Info',
    cell: info => {
      const meta = info.getValue()
      if (!meta) return null
      return (
        <Tooltip>
          <TooltipTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors">
            <Info className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent className="bg-card border-border text-card-foreground max-w-sm p-4 shadow-xl">
            <pre className="text-[11px] overflow-auto max-h-60 font-mono leading-relaxed">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </TooltipContent>
        </Tooltip>
      )
    },
    size: 50,
  }),
]

export function AuditLogTable({ data, pagination, onPageChange, onSearch }: any) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Search and Header */}
      <div className="flex flex-col sm:flex-row gap-4 p-6 bg-secondary/30 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per evento o fingerprint..."
            className="pl-9 bg-background border-border text-foreground ring-offset-background"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border bg-secondary/20">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-4 font-semibold text-foreground uppercase tracking-wider text-[10px]">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                className="border-b border-border/50 hover:bg-secondary/10 transition-colors group"
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
        <div className="text-xs text-muted-foreground">
          Pagina {pagination.page} di {pagination.pages} ({pagination.total} log totali)
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="border-border text-foreground hover:bg-secondary h-8"
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="border-border text-foreground hover:bg-secondary h-8"
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}
