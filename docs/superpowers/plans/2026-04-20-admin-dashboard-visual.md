# Admin Dashboard Visual Enhancement - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real recharts LineChart and detailed data tables (company rankings + vote log) to admin dashboard.

**Architecture:** 
- Install dependencies (recharts, tanstack-table, date-fns)
- Create two new API routes: `/api/admin/companies` and `/api/admin/votes`
- Build two table components with sorting, search, pagination
- Replace placeholder chart with recharts LineChart
- Apply Fuser Studio design tokens throughout

**Tech Stack:** Next.js 14, TypeScript, recharts, @tanstack/react-table, date-fns, shadcn/ui

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install recharts @tanstack/react-table date-fns
```

---

### Task 2: Create API - GET /api/admin/companies

**Files:**
- Create: `src/app/api/admin/companies/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // Get companies with vote counts
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, category, image_url, batch')
      .ilike('name', `%${search}%`)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get vote counts per company
    const { data: votes } = await supabase
      .from('votes')
      .select('company_id, created_at')

    const voteCounts: Record<string, number> = {}
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const yesterdayVotes: Record<string, number> = {}
    const todayVotes: Record<string, number> = {}

    votes?.forEach(v => {
      const date = v.created_at.split('T')[0]
      voteCounts[v.company_id] = (voteCounts[v.company_id] || 0) + 1
      
      if (date === today) todayVotes[v.company_id] = (todayVotes[v.company_id] || 0) + 1
      if (date === yesterday) yesterdayVotes[v.company_id] = (yesterdayVotes[v.company_id] || 0) + 1
    })

    const result = (companies || []).map((c, idx) => {
      const votes = voteCounts[c.id] || 0
      const todayV = todayVotes[c.id] || 0
      const yesterdayV = yesterdayVotes[c.id] || 0
      const trend = todayV - yesterdayV
      
      return {
        rank: idx + 1,
        id: c.id,
        name: c.name,
        category: c.category || '-',
        image_url: c.image_url,
        votes,
        trend
      }
    })

    // Sort by votes desc by default
    result.sort((a, b) => b.votes - a.votes)

    // Re-assign ranks after sorting
    result.forEach((r, i) => r.rank = i + 1)

    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test the endpoint**

Run dev server and visit: `http://localhost:3000/api/admin/companies`

Expected: JSON array of companies with vote counts

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/companies/route.ts
git commit -m "feat: add GET /api/admin/companies endpoint"
```

---

### Task 3: Create API - GET /api/admin/votes

**Files:**
- Create: `src/app/api/admin/votes/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * limit

    // Get companies for join
    const { data: companies } = await supabase.from('companies').select('id, name')
    const companyMap = new Map((companies || []).map(c => [c.id, c.name]))

    let query = supabase
      .from('votes')
      .select('id, company_id, fingerprint, country, user_agent, created_at')
      .order('created_at', { ascending: false })

    if (search) {
      // Filter by company name (requires join, so we fetch more and filter)
      const matchingCompanyIds = (companies || [])
        .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        .map(c => c.id)
      
      if (matchingCompanyIds.length > 0) {
        query = query.in('company_id', matchingCompanyIds)
      }
    }

    const { data: votes, error } = await query.range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = (votes || []).map(v => ({
      id: v.id,
      timestamp: v.created_at,
      company: companyMap.get(v.company_id) || 'Unknown',
      fingerprint: v.fingerprint ? v.fingerprint.slice(0, 8) + '...' : '-',
      country: v.country || '-',
      device: v.user_agent ? v.user_agent.split(' ')[0] : '-'
    }))

    // Get total count
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test the endpoint**

Visit: `http://localhost:3000/api/admin/votes?page=1&limit=10`

Expected: JSON with data array and pagination info

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/votes/route.ts
git commit -m "feat: add GET /api/admin/votes endpoint"
```

---

### Task 4: Create Company Table Component

**Files:**
- Create: `src/components/admin/company-table.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
    cell: info => <span className="text-muted-foreground">{info.getValue()}</span>,
    size: 60,
  }),
  columnHelper.accessor('image_url', {
    header: '',
    cell: info => {
      const url = info.getValue()
      if (url) {
        return <img src={url} alt="" className="w-8 h-8 rounded object-cover" />
      }
      return <div className="w-8 h-8 rounded bg-surface-alt" />
    },
    size: 48,
  }),
  columnHelper.accessor('name', {
    header: 'Azienda',
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('category', {
    header: 'Categoria',
    cell: info => <span className="text-muted-foreground">{info.getValue()}</span>,
    size: 120,
  }),
  columnHelper.accessor('votes', {
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4"
      >
        Voti
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => <span className="font-semibold">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('trend', {
    header: 'Trend',
    cell: info => {
      const trend = info.getValue()
      if (trend > 0) return <span className="text-green-500 flex items-center gap-1"><TrendingUp className="w-4 h-4" />+{trend}</span>
      if (trend < 0) return <span className="text-red-500 flex items-center gap-1"><TrendingDown className="w-4 h-4" />{trend}</span>
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
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-alt">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
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
              <tr key={row.id} className="border-t hover:bg-surface-alt transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Pagina {table.getState().pagination.pageIndex + 1} di {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/company-table.tsx
git commit -m "feat: add CompanyTable component with sorting and pagination"
```

---

### Task 5: Create Vote Log Table Component

**Files:**
- Create: `src/components/admin/vote-log-table.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
        className="-ml-4"
      >
        Data/Ora
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: info => (
      <span className="text-muted-foreground">
        {format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm', { locale: it })}
      </span>
    ),
    size: 160,
  }),
  columnHelper.accessor('company', {
    header: 'Azienda',
    cell: info => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('fingerprint', {
    header: 'Fingerprint',
    cell: info => <code className="text-xs text-muted-foreground">{info.getValue()}</code>,
    size: 120,
  }),
  columnHelper.accessor('country', {
    header: 'Paese',
    cell: info => <span className="text-muted-foreground">{info.getValue()}</span>,
    size: 80,
  }),
  columnHelper.accessor('device', {
    header: 'Device',
    cell: info => <span className="text-muted-foreground">{info.getValue()}</span>,
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-alt">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
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
              <tr key={row.id} className="border-t hover:bg-surface-alt transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {pagination.total} voti totali • Pagina {pagination.page} di {pagination.pages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
          >
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/vote-log-table.tsx
git commit -m "feat: add VoteLogTable component with pagination and export"
```

---

### Task 6: Update Dashboard with Chart and Tables

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Update imports**

Add after existing imports:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { CompanyTable } from '@/components/admin/company-table'
import { VoteLogTable } from '@/components/admin/vote-log-table'
```

- [ ] **Step 2: Add interfaces**

Add after existing interfaces:
```tsx
interface Vote {
  id: string
  timestamp: string
  company: string
  fingerprint: string
  country: string
  device: string
}

interface Company {
  rank: number
  id: string
  name: string
  category: string
  image_url: string | null
  votes: number
  trend: number
}

interface VotePagination {
  page: number
  limit: number
  total: number
  pages: number
}
```

- [ ] **Step 3: Add state for new data**

In the component, add to useState:
```tsx
const [companies, setCompanies] = useState<Company[]>([])
const [votes, setVotes] = useState<Vote[]>([])
const [votePagination, setVotePagination] = useState<VotePagination>({
  page: 1,
  limit: 25,
  total: 0,
  pages: 0
})
const [voteSearch, setVoteSearch] = useState('')
```

- [ ] **Step 4: Update loadData function**

Replace existing loadData with:
```tsx
const loadData = async () => {
  setLoading(true)
  try {
    // Load summary stats
    const statsRes = await fetch('/api/analytics?type=summary')
    const statsData = await statsRes.json()
    setStats({
      totalVotes: statsData.totalVotes || 0,
      uniqueVoters: statsData.uniqueVoters || 0,
      todayVotes: statsData.dailyStats?.[0]?.vote_count || 0,
      activeNow: 0
    })
    setDailyStats(statsData.dailyStats || [])

    // Load companies
    const companiesRes = await fetch('/api/admin/companies')
    const companiesData = await companiesRes.json()
    setCompanies(companiesData.data || [])

    // Load votes
    loadVotes(1, '')
  } catch (e) {
    console.error(e)
  } finally {
    setLoading(false)
  }
}

const loadVotes = async (page: number, search: string) => {
  const params = new URLSearchParams({ page: page.toString(), limit: '25' })
  if (search) params.append('search', search)
  const res = await fetch(`/api/admin/votes?${params}`)
  const data = await res.json()
  setVotes(data.data || [])
  setVotePagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 0 })
}
```

- [ ] **Step 5: Replace chart section**

Replace the chart placeholder with:
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <BarChart3 className="h-5 w-5" />
      Andamento Votazioni
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="h-[280px]">
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <span>Caricamento...</span>
        </div>
      ) : dailyStats.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...dailyStats].reverse()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2A26" />
            <XAxis 
              dataKey="date" 
              stroke="#8C8882" 
              fontSize={12}
              tickFormatter={(v) => {
                try { return format(new Date(v), 'dd/MM', { locale: it }) } 
                catch { return v }
              }}
            />
            <YAxis stroke="#8C8882" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#181614', 
                border: '1px solid #2E2A26',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#F0EDE8' }}
              itemStyle={{ color: '#FF6A1A' }}
              formatter={(value: number) => [value, '']}
              labelFormatter={(label) => {
                try { return format(new Date(label), 'dd MMMM yyyy', { locale: it }) }
                catch { return label }
              }}
            />
            <Line 
              type="monotone" 
              dataKey="vote_count" 
              stroke="#FF6A1A" 
              strokeWidth={2}
              dot={{ fill: '#FF6A1A', strokeWidth: 0 }}
              name="Voti"
            />
            <Line 
              type="monotone" 
              dataKey="unique_voters" 
              stroke="#8C8882" 
              strokeWidth={2}
              dot={{ fill: '#8C8882', strokeWidth: 0 }}
              name="Elettori"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Nessun dato disponibile
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 6: Add table sections after chart**

Add after the chart card:
```tsx
{/* Company Rankings Table */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Users className="h-5 w-5" />
      Classifica Aziende
    </CardTitle>
  </CardHeader>
  <CardContent>
    <CompanyTable data={companies} />
  </CardContent>
</Card>

{/* Vote Log Table */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Vote className="h-5 w-5" />
      Registro Voti
    </CardTitle>
  </CardHeader>
  <CardContent>
    <VoteLogTable 
      data={votes} 
      pagination={votePagination}
      onPageChange={(page) => loadVotes(page, voteSearch)}
      onSearch={(search) => {
        setVoteSearch(search)
        loadVotes(1, search)
      }}
    />
  </CardContent>
</Card>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/dashboard/page.tsx
git commit -m "feat: add recharts chart and data tables to admin dashboard"
```

---

### Task 7: Verify and Test

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test dashboard**

Navigate to: `http://localhost:3000/admin/dashboard`

Verify:
- [ ] Chart shows real data with two lines
- [ ] Company table shows with sorting and search
- [ ] Vote log table shows with pagination
- [ ] Export CSV works on vote log
- [ ] No console errors

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete admin dashboard visual enhancement"
```

---

## Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| recharts | ^2.x | LineChart for vote trends |
| @tanstack/react-table | ^8.x | Tables with sorting/pagination |
| date-fns | ^3.x | Date formatting |

---

## File Summary

| File | Action |
|------|--------|
| `src/app/api/admin/companies/route.ts` | Create |
| `src/app/api/admin/votes/route.ts` | Create |
| `src/components/admin/company-table.tsx` | Create |
| `src/components/admin/vote-log-table.tsx` | Create |
| `src/app/admin/dashboard/page.tsx` | Modify |
| `package.json` | Modify (dependencies) |