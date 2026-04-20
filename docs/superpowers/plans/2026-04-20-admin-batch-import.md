# Batch Import System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admin to import companies via CSV with batch system, public page shows only active batch.

**Architecture:** 
- Add `batch` column to companies table
- Create API endpoints for CSV import and batch management
- Create admin import page with preview and confirmation
- Modify public page query to filter by active batch

**Tech Stack:** Next.js, Supabase, React, Tailwind CSS

---

### Task 1: Database Schema - Add Batch Column

**Files:**
- Modify: Supabase (SQL via Supabase SQL Editor)

- [ ] **Step 1: Add batch column to companies table**

Run in Supabase SQL Editor:
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS batch TEXT DEFAULT 'TEST';
```

- [ ] **Step 2: Add batch_settings table for active batch**

Run in Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS batch_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  active_batch TEXT NOT NULL DEFAULT 'TEST',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO batch_settings (id, active_batch) VALUES ('default', 'TEST')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Verify columns exist**

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'companies' AND column_name = 'batch';
```

---

### Task 2: API - Batch Import Endpoint

**Files:**
- Create: `src/app/api/admin/companies/import/route.ts`

- [ ] **Step 1: Create import API endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const batchName = formData.get('batchName') as string

    if (!file || !batchName) {
      return NextResponse.json({ error: 'File and batch name required' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV empty or invalid' }, { status: 400 })
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredFields = ['name']
    
    for (const field of requiredFields) {
      if (!headers.includes(field)) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const supabase = await createClient()
    const companies = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: Record<string, string> = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      if (row.name) {
        companies.push({
          name: row.name,
          category: row.category || null,
          image_url: row.image_url || null,
          batch: batchName
        })
      }
    }

    const { error } = await supabase
      .from('companies')
      .insert(companies)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Import completed',
      count: companies.length,
      batch: batchName
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create batch management API**

**Files:**
- Create: `src/app/api/admin/batch/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: settings } = await supabase
    .from('batch_settings')
    .select('active_batch')
    .eq('id', 'default')
    .single()

  const { data: batches } = await supabase
    .from('companies')
    .select('batch')
    .not('batch', 'is', null)

  const uniqueBatches = [...new Set((batches || []).map(b => b.batch))]

  return NextResponse.json({
    activeBatch: settings?.active_batch || 'TEST',
    batches: uniqueBatches
  })
}

export async function POST(request: NextRequest) {
  try {
    const { activeBatch } = await request.json()

    if (!activeBatch) {
      return NextResponse.json({ error: 'activeBatch required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    const { error } = await supabase
      .from('batch_settings')
      .update({ active_batch: activeBatch, updated_at: new Date().toISOString() })
      .eq('id', 'default')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Batch updated', activeBatch })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create CSV template download endpoint**

**Files:**
- Create: `src/app/api/admin/companies/template/route.ts`

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const csv = 'name,category,image_url\nAzienda Esempio,Categoria Opzionale,https://esempio.com/logo.png'

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=template_aziende.csv'
    }
  })
}
```

---

### Task 3: Admin Import Page

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx` - Add import button navigation
- Create: `src/app/admin/import/page.tsx`

- [ ] **Step 1: Update dashboard to link to import page**

Modify `src/app/admin/dashboard/page.tsx` - change Import button:
```typescript
<Button variant="outline" onClick={() => router.push('/admin/import')}>
  <Upload className="h-4 w-4 mr-2" />
  Import Aziende
</Button>
```

- [ ] **Step 2: Create import page**

Create `src/app/admin/import/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, Check, X, ArrowLeft } from 'lucide-react'

interface BatchInfo {
  activeBatch: string
  batches: string[]
}

interface ParsedRow {
  name: string
  category?: string
  image_url?: string
}

export default function ImportPage() {
  const router = useRouter()
  const [batchInfo, setBatchInfo] = useState<BatchInfo>({ activeBatch: 'TEST', batches: ['TEST'] })
  const [file, setFile] = useState<File | null>(null)
  const [batchName, setBatchName] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAuth()
    fetchBatchInfo()
  }, [])

  const checkAuth = async () => {
    const session = localStorage.getItem('admin_session')
    if (!session) {
      router.push('/admin/login')
      return
    }
    
    const res = await fetch('/api/admin/login', {
      headers: { Authorization: `Bearer ${session}` }
    })
    
    if (!res.ok) {
      localStorage.removeItem('admin_session')
      router.push('/admin/login')
    }
  }

  const fetchBatchInfo = async () => {
    const res = await fetch('/api/admin/batch')
    const data = await res.json()
    setBatchInfo(data)
    setBatchName(data.activeBatch)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setMessage('')

    const text = await selectedFile.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      setMessage('CSV vuoto o non valido')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const parsed: ParsedRow[] = []

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      if (row.name) parsed.push(row as ParsedRow)
    }

    setPreview(parsed)
  }

  const handleImport = async () => {
    if (!file || !batchName) return

    setUploading(true)
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('batchName', batchName)

    try {
      const res = await fetch('/api/admin/companies/import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Errore import')
      } else {
        setMessage(`${data.count} aziende importate nel batch "${batchName}"`)
        setFile(null)
        setPreview([])
        fetchBatchInfo()
      }
    } catch {
      setMessage('Errore durante import')
    } finally {
      setUploading(false)
    }
  }

  const handleSetActive = async (batch: string) => {
    const res = await fetch('/api/admin/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeBatch: batch })
    })

    if (res.ok) {
      setBatchInfo(prev => ({ ...prev, activeBatch: batch }))
      setMessage(`Batch "${batch}" ora attivo`)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-xl">Import Aziende</h1>
        </div>
      </header>

      <div className="container px-4 py-6 space-y-6 max-w-2xl">
        {/* Template Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Scarica Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.open('/api/admin/companies/template', '_blank')}>
              Scarica CSV Template
            </Button>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Carica CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome Batch</label>
              <Input 
                value={batchName} 
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="es. PRODUZIONE_2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Seleziona File CSV</label>
              <Input 
                type="file" 
                accept=".csv"
                onChange={handleFileChange}
              />
            </div>

            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Preview (prime 5 righe):</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">Categoria</th>
                        <th className="px-3 py-2 text-left">Logo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.category || '-'}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{row.image_url || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {file && batchName && (
              <Button onClick={handleImport} disabled={uploading}>
                {uploading ? 'Import in corso...' : 'Conferma Import'}
              </Button>
            )}

            {message && (
              <p className={message.includes('errore') ? 'text-red-500' : 'text-green-500'}>
                {message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Batch Management */}
        <Card>
          <CardHeader>
            <CardTitle>Gestione Batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {batchInfo.batches.map(batch => (
                <div key={batch} className="flex items-center gap-2">
                  <Button 
                    variant={batchInfo.activeBatch === batch ? 'default' : 'outline'}
                    onClick={() => handleSetActive(batch)}
                  >
                    {batch === batchInfo.activeBatch && <Check className="h-4 w-4 mr-1" />}
                    {batch}
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Batch attivo: <strong>{batchInfo.activeBatch}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

---

### Task 4: Public Page - Filter by Active Batch

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Modify loadCompanies to filter by active batch**

Modify `src/app/page.tsx`:

Add state for active batch:
```typescript
const [activeBatch, setActiveBatch] = useState<string | null>(null)
```

Modify `loadCompanies` function to include batch filter:
```typescript
const loadCompanies = useCallback(async (query: string) => {
  if (!supabase) return
  setLoading(true)
  
  // Get active batch first
  const { data: settings } = await supabase
    .from('batch_settings')
    .select('active_batch')
    .eq('id', 'default')
    .single()
  
  const activeBatch = settings?.active_batch || 'TEST'
  setActiveBatch(activeBatch)

  let dbQuery = supabase
    .from('companies')
    .select('id, name, category, image_url')
    .eq('batch', activeBatch)
    .order('name')

  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`)
  }

  const { data, error } = await dbQuery
  const companiesList = (data || []) as Company[]
  setCompanies(companiesList)
  setLoading(false)
  console.log('Loaded companies:', companiesList.length, 'batch:', activeBatch)
}, [supabase])
```

---

### Task 5: Verify and Test

**Files:**
- Verify in browser

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

- [ ] **Step 2: Test in browser**

1. Login to admin: http://localhost:3000/admin/login
2. Go to Import: http://localhost:3000/admin/import
3. Download template CSV
4. Create CSV with test data
5. Upload and import
6. Set active batch
7. Verify public page shows only active batch

---

### Summary

- [ ] Task 1: Database Schema - Add Batch Column
- [ ] Task 2: API - Batch Import Endpoint
- [ ] Task 3: Admin Import Page
- [ ] Task 4: Public Page - Filter by Active Batch
- [ ] Task 5: Verify and Test
