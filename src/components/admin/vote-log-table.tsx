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
import { Search, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Vote {
  id: string
  timestamp: string
  company: string
  fingerprint: string
  country: string
  device: string
  comment: string
  adjective: string
  slider_innovation: number
  slider_sales: number
  slider_wow: number
}

const columnHelper = createColumnHelper<Vote>()

const columns = [
  columnHelper.accessor('timestamp', {
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 text-foreground hover:bg-secondary"
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
  columnHelper.accessor('company', {
    header: 'Azienda',
    cell: info => <span className="font-semibold text-foreground text-sm truncate max-w-[200px] block">{info.getValue()}</span>,
  }),
  columnHelper.accessor('fingerprint', {
    header: 'ID',
    cell: info => <code className="text-[10px] text-muted-foreground bg-secondary/50 px-1 py-0.5 rounded font-mono">{info.getValue()?.substring(0, 8)}</code>,
    size: 80,
  }),
  columnHelper.accessor('country', {
    header: 'P.',
    cell: info => <span className="text-muted-foreground font-medium text-xs">{info.getValue() || 'IT'}</span>,
    size: 40,
  }),
  columnHelper.accessor('device', {
    header: 'Device',
    cell: info => <span className="text-muted-foreground text-[10px] truncate max-w-[120px] block">{info.getValue() || 'Desktop'}</span>,
    size: 100,
  }),
  columnHelper.accessor('comment', {
    header: 'Commento',
    cell: info => <span className="text-muted-foreground text-xs truncate max-w-[200px] block">{info.getValue() || '-'}</span>,
    size: 200,
  }),
  columnHelper.accessor('adjective', {
    header: 'Aggettivo',
    cell: info => <span className="text-muted-foreground text-xs font-medium">{info.getValue() || '-'}</span>,
    size: 100,
  }),
  columnHelper.accessor('slider_innovation', {
    header: 'Innovazione',
    cell: info => <span className="text-muted-foreground text-xs">{info.getValue() ?? '-'}</span>,
    size: 80,
  }),
  columnHelper.accessor('slider_sales', {
    header: 'Vendibilità',
    cell: info => <span className="text-muted-foreground text-xs">{info.getValue() ?? '-'}</span>,
    size: 80,
  }),
  columnHelper.accessor('slider_wow', {
    header: 'Wow',
    cell: info => <span className="text-muted-foreground text-xs">{info.getValue() ?? '-'}</span>,
    size: 80,
  }),
]

export function VoteLogTable({ data, pagination, onPageChange, onSearch }: {
  data: Vote[]
  pagination: { page: number; limit: number; total: number; pages: number }
  onPageChange: (page: number) => void
  onSearch: (search: string) => void
}) {
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
    <div className="space-y-0">
      <div className="flex flex-col sm:flex-row gap-4 p-6 bg-secondary/30 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
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

      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/10">
        <div className="text-xs text-muted-foreground">
          Pagina {pagination.page} di {pagination.pages} ({pagination.total} voti totali)
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