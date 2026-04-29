'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Company {
  rank: number
  id: string
  name: string
  category: string
  image_url: string | null
  votes: number
  trend: number
}

const columnHelper = createColumnHelper<Company>()

const columns = [
  columnHelper.accessor('rank', {
    header: '#',
    cell: info => <span className="text-muted-foreground font-mono">{info.getValue()}</span>,
    size: 60,
  }),
  columnHelper.accessor('image_url', {
    header: '',
    cell: info => {
      const url = info.getValue()
      if (url) {
        return <img src={url} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-border" />
      }
      return <div className="w-8 h-8 rounded-lg bg-secondary" />
    },
    size: 48,
  }),
  columnHelper.accessor('name', {
    header: 'Azienda',
    cell: info => <span className="font-semibold text-foreground">{info.getValue()}</span>,
  }),
  columnHelper.accessor('category', {
    header: 'Categoria',
    cell: info => <span className="text-muted-foreground text-xs uppercase tracking-wider">{info.getValue()}</span>,
    size: 140,
  }),
  columnHelper.accessor('votes', {
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 text-foreground hover:bg-secondary"
      >
        Voti
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => <span className="font-bold text-foreground">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('trend', {
    header: 'Trend',
    cell: info => {
      const trend = info.getValue()
      if (trend > 0) return <span className="text-green-500 font-medium flex items-center gap-1"><TrendingUp className="w-4 h-4" />+{trend}</span>
      if (trend < 0) return <span className="text-red-500 font-medium flex items-center gap-1"><TrendingDown className="w-4 h-4" />{trend}</span>
      return <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-4 h-4" />0</span>
    },
    size: 80,
  }),
]

export function CompanyTable({ data }: { data: Company[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'votes', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-4 p-6 bg-secondary/30 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-9 bg-background border-border text-foreground ring-offset-background"
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
              <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors group">
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

      <div className="flex items-center justify-between px-6 py-4 bg-secondary/10 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Pagina {table.getState().pagination.pageIndex + 1} di {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-border text-foreground hover:bg-secondary h-8"
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-border text-foreground hover:bg-secondary h-8"
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}