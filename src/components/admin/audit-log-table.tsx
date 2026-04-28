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
        className="-ml-4 text-[#F0EDE8]"
      >
        Data/Ora
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => (
      <span className="text-[#8C8882]">
        {format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm', { locale: it })}
      </span>
    ),
    size: 160,
  }),
  columnHelper.accessor('event_type', {
    header: 'Evento',
    cell: info => {
      const type = info.getValue()
      const isSecurity = type.includes('block') || type.includes('fraud') || type.includes('fail')
      return (
        <div className="flex items-center gap-2">
          {isSecurity && <ShieldAlert className="h-4 w-4 text-red-500" />}
          <span className={`font-medium ${isSecurity ? 'text-red-500' : 'text-[#F0EDE8]'}`}>
            {type}
          </span>
        </div>
      )
    },
  }),
  columnHelper.accessor('fingerprint', {
    header: 'Fingerprint',
    cell: info => <code className="text-xs text-[#8C8882]">{info.getValue()?.substring(0, 12)}...</code>,
    size: 120,
  }),
  columnHelper.accessor('ip_address', {
    header: 'IP',
    cell: info => <span className="text-[#8C8882]">{info.getValue() || 'unknown'}</span>,
    size: 120,
  }),
// Metadata details removed TooltipProvider wrapper since it's now in RootLayout
  columnHelper.accessor('metadata', {
    header: 'Dettagli',
    cell: info => {
      const meta = info.getValue()
      if (!meta) return null
      return (
        <Tooltip>
          <TooltipTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#8C8882] hover:bg-[#221F1C] transition-colors">
            <Info className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent className="bg-[#181614] border-[#2E2A26] text-[#F0EDE8] max-w-xs">
            <pre className="text-[10px] overflow-auto max-h-40">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </TooltipContent>
        </Tooltip>
      )
    },
    size: 60,
  }),
]

export function AuditLogTable({ data, pagination, onPageChange, onSearch }: {
  data: AuditLog[]
  pagination: { page: number; limit: number; total: number; pages: number }
  onPageChange: (page: number) => void
  onSearch: (search: string) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: pagination.pages,
  })

  const handleSearch = () => onSearch(search)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8882]" />
          <Input
            placeholder="Cerca fingerprint o evento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9 bg-[#0D0C0B] border-[#2E2A26] text-[#F0EDE8] placeholder:text-[#8C8882]"
          />
        </div>
      </div>

      <div className="border border-[#2E2A26] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#221F1C]">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-[#8C8882]"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-t border-[#2E2A26] hover:bg-[#221F1C] transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-[#F0EDE8]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[#8C8882]">
                  Nessun evento di sicurezza registrato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-[#8C8882]">
          {pagination.total} eventi totali • Pagina {pagination.page} di {pagination.pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C]"
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C]"
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}
