'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, Check, ArrowLeft } from 'lucide-react'

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
      if (row.name && row.name.trim()) {
        parsed.push({
          name: row.name.trim(),
          category: row.category?.trim(),
          image_url: row.image_url?.trim()
        })
      }
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