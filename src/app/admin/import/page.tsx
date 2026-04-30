'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, Check } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/sidebar'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    <div className="min-h-screen bg-background transition-colors duration-300">
      <AdminSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <main className={`transition-all duration-300 min-h-screen pb-12 ${sidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[260px]'}`}>
        <div className="max-w-[800px] mx-auto p-6 md:p-8 space-y-6">
          <div className="pt-12 md:pt-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Import Aziende
            </h1>
            <p className="text-muted-foreground mt-1">Carica aziende da CSV</p>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Download className="h-5 w-5 text-primary" />
                Scarica Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                onClick={() => window.open('/api/admin/companies/template', '_blank')}
                className="border-border text-foreground hover:bg-secondary"
              >
                Scarica CSV Template
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Upload className="h-5 w-5 text-primary" />
                Carica CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nome Batch</label>
                <Input 
                  value={batchName} 
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="es. PRODUZIONE_2024"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Seleziona File CSV</label>
                <Input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileChange}
                  className="bg-background border-border text-foreground file:text-foreground file:bg-primary file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-4"
                />
              </div>

              {preview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Preview (prime 5 righe):</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left text-muted-foreground">Nome</th>
                          <th className="px-3 py-2 text-left text-muted-foreground">Categoria</th>
                          <th className="px-3 py-2 text-left text-muted-foreground">Logo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2 text-foreground">{row.name}</td>
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
                <Button 
                  onClick={handleImport} 
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
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

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground">Gestione Batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {batchInfo.batches.map(batch => (
                  <Button 
                    key={batch}
                    variant={batchInfo.activeBatch === batch ? 'default' : 'outline'}
                    onClick={() => handleSetActive(batch)}
                    className={batchInfo.activeBatch === batch 
                      ? 'bg-primary hover:bg-primary/90 text-white'
                      : 'border-border text-foreground hover:bg-secondary'
                    }
                  >
                    {batchInfo.activeBatch === batch && <Check className="h-4 w-4 mr-1" />}
                    {batch}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Batch attivo: <strong className="text-foreground">{batchInfo.activeBatch}</strong>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}