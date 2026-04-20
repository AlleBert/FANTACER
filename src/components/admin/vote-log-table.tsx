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
import { Search, Download, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Vote {
  id: string
  timestamp: string
  company: string
  fingerprint: string
  country: string
  device: string
}

const columnHelper = createColumnHelper<Vote>()

const columns = [
  columnHelper.accessor('timestamp', {
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
  columnHelper.accessor('company', {
    header: 'Azienda',
    cell: info => <span className="font-medium text-[#F0EDE8]">{info.getValue()}</span>,
  }),
  columnHelper.accessor('fingerprint', {
    header: 'Fingerprint',
    cell: info => <code className="text-xs text-[#8C8882]">{info.getValue()}</code>,
    size: 120,
  }),
  columnHelper.accessor('country', {
    header: 'Paese',
    cell: info => <span className="text-[#8C8882]">{info.getValue()}</span>,
    size: 80,
  }),
  columnHelper.accessor('device', {
    header: 'Device',
    cell: info => <span className="text-[#8C8882]">{info.getValue()}</span>,
  }),
]

export function VoteLogTable({ data, pagination, onPageChange, onSearch }: {
  data: Vote[]
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

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Azienda', 'Fingerprint', 'Paese', 'Device'].join(','),
      ...data.map(v => [
        v.timestamp,
        v.company,
        v.fingerprint,
        v.country,
        v.device
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vote_log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8882]" />
          <Input
            placeholder="Cerca azienda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9 bg-[#0D0C0B] border-[#2E2A26] text-[#F0EDE8] placeholder:text-[#8C8882]"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C]">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-t border-[#2E2A26] hover:bg-[#221F1C] transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-[#F0EDE8]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-[#8C8882]">
          {pagination.total} voti totali • Pagina {pagination.page} di {pagination.pages}
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