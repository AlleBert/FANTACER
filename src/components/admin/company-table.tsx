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
    cell: info => <span className="text-[#8C8882]">{info.getValue()}</span>,
    size: 60,
  }),
  columnHelper.accessor('image_url', {
    header: '',
    cell: info => {
      const url = info.getValue()
      if (url) {
        return <img src={url} alt="" className="w-8 h-8 rounded object-cover" />
      }
      return <div className="w-8 h-8 rounded bg-[#221F1C]" />
    },
    size: 48,
  }),
  columnHelper.accessor('name', {
    header: 'Azienda',
    cell: info => <span className="font-medium text-[#F0EDE8]">{info.getValue()}</span>,
  }),
  columnHelper.accessor('category', {
    header: 'Categoria',
    cell: info => <span className="text-[#8C8882]">{info.getValue()}</span>,
    size: 120,
  }),
  columnHelper.accessor('votes', {
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 text-[#F0EDE8]"
      >
        Voti
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => <span className="font-semibold text-[#F0EDE8]">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('trend', {
    header: 'Trend',
    cell: info => {
      const trend = info.getValue()
      if (trend > 0) return <span className="text-green-500 flex items-center gap-1"><TrendingUp className="w-4 h-4" />+{trend}</span>
      if (trend < 0) return <span className="text-red-500 flex items-center gap-1"><TrendingDown className="w-4 h-4" />{trend}</span>
      return <span className="text-[#8C8882] flex items-center gap-1"><Minus className="w-4 h-4" />0</span>
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
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8882]" />
          <Input
            placeholder="Cerca azienda..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
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
          Pagina {table.getState().pagination.pageIndex + 1} di {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C]"
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#2E2A26] text-[#F0EDE8] hover:bg-[#221F1C]"
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}