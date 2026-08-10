'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, Check, Trash2, Building2, Vote, AlertTriangle, X, CheckCircle, AlertCircle, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BatchItem {
  name: string
  companyCount: number
  voteCount: number
}

interface BatchInfo {
  activeBatch: string
  batches: BatchItem[]
}

interface ParsedRow {
  name: string
  category?: string
  image_url?: string
}

type Notification = { type: 'success' | 'error' | 'info'; text: string }

export default function ImportPage() {
  const [batchInfo, setBatchInfo] = useState<BatchInfo>({ activeBatch: 'TEST', batches: [] })
  const [file, setFile] = useState<File | null>(null)
  const [batchName, setBatchName] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BatchItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isNewBatch, setIsNewBatch] = useState(false)
  const [batchSelectOpen, setBatchSelectOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batchSelectRef = useRef<HTMLDivElement>(null)

  const fetchBatchInfo = async () => {
    const res = await fetch('/api/admin/batch')
    const data = await res.json()
    setBatchInfo(data)
    setBatchName(data.activeBatch)
  }

  useEffect(() => {
    const res = fetch('/api/admin/batch').then(r => r.json())
    res.then(data => {
      setBatchInfo(data)
      setBatchName(data.activeBatch)
    })
  }, [])

  useEffect(() => {
    if (!batchSelectOpen) return
    const handler = (e: MouseEvent) => {
      if (batchSelectRef.current && !batchSelectRef.current.contains(e.target as Node)) {
        setBatchSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [batchSelectOpen])

  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 4000)
    return () => clearTimeout(t)
  }, [notification])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    simulateFileSelect(selectedFile)
  }

  const handleBatchSelect = (value: string) => {
    if (value === '__new__') {
      setIsNewBatch(true)
      setBatchName('')
    } else {
      setIsNewBatch(false)
      setBatchName(value)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const isValid = droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv')
      if (!isValid) {
        setNotification({ type: 'error', text: 'Formato file non supportato. Usa .xlsx o .csv' })
        return
      }
      simulateFileSelect(droppedFile)
    }
  }

  const simulateFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setNotification(null)

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')
    if (isExcel) {
      setNotification({ type: 'info', text: `File Excel caricato: ${selectedFile.name}` })
      setPreview([])
      return
    }

    const text = await selectedFile.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      setNotification({ type: 'error', text: 'CSV vuoto o non valido' })
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
    setNotification(null)

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
        setNotification({ type: 'error', text: data.error || 'Errore import' })
      } else {
        setNotification({ type: 'success', text: `${data.count} aziende importate nel batch "${batchName}"` })
        setFile(null)
        setPreview([])
        fetchBatchInfo()
      }
    } catch {
      setNotification({ type: 'error', text: 'Errore durante import' })
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
      setNotification({ type: 'success', text: `Batch "${batch}" ora attivo` })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchName: deleteTarget.name })
      })

      const data = await res.json()
      if (res.ok) {
        setNotification({ type: 'success', text: data.message || `Batch "${deleteTarget.name}" eliminato` })
        fetchBatchInfo()
      } else {
        setNotification({ type: 'error', text: data.error || 'Errore durante eliminazione' })
      }
    } catch {
      setNotification({ type: 'error', text: 'Errore durante eliminazione' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}>
            {notification.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" />
              : notification.type === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" />
              : <AlertTriangle className="h-5 w-5 shrink-0" />}
            <p className="text-sm font-medium">{notification.text}</p>
            <button onClick={() => setNotification(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !deleting && setDeleteTarget(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Eliminare batch?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Questa azione è irreversibile
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg px-4 py-3 mb-4">
                <p className="font-semibold text-foreground text-sm">{deleteTarget.name}</p>
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-sm text-muted-foreground font-medium">Verranno eliminati definitivamente:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{deleteTarget.companyCount}</p>
                    <p className="text-xs text-muted-foreground">Aziende</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-foreground">{deleteTarget.voteCount}</p>
                    <p className="text-xs text-muted-foreground">Voti</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Più statistiche giornaliere e dati analytics associati</p>
              </div>

              {batchInfo.activeBatch === deleteTarget.name && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 mb-4 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Questo batch è attualmente attivo. Dopo l&apos;eliminazione verrà impostato <strong>&quot;TEST&quot;</strong> come batch attivo.</span>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}
                  className="border-border text-foreground hover:bg-secondary flex-1">
                  Annulla
                </Button>
                <Button onClick={handleConfirmDelete} disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1">
                  {deleting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Eliminazione...
                    </span>
                  ) : 'Elimina'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[800px] mx-auto p-6 md:p-8 space-y-6">
        <div className="pt-12 md:pt-0">
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground">
            Import Aziende
          </h1>
          <p className="text-muted-foreground mt-1 text-[clamp(0.75rem,2.5vw,1rem)]">Carica aziende da Excel o CSV</p>
        </div>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Download className="h-5 w-5 text-primary" />
              Scarica Template
            </CardTitle>
            <CardDescription>
              Il template Excel contiene le colonne necessarie per l&apos;import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'name', desc: 'Nome azienda', icon: Building2 },
                { label: 'category', desc: 'Categoria', icon: FileText },
                { label: 'image_url', desc: 'URL logo (opzionale)', icon: FileText },
              ].map(col => (
                <div key={col.label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary/50 px-2.5 py-1.5 rounded-lg border border-border/50">
                  <col.icon className="h-3 w-3 text-primary" />
                  <span className="font-semibold text-foreground">{col.label}</span>
                  <span className="text-muted-foreground">— {col.desc}</span>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.open('/api/admin/companies/template', '_blank')}
              className="border-border text-foreground hover:bg-secondary"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Scarica Template Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Upload className="h-5 w-5 text-primary" />
              Carica File
            </CardTitle>
            <CardDescription>
              Carica un file Excel (.xlsx) o CSV con le aziende da importare
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Batch name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Batch di destinazione</label>
              <div className="space-y-2">
                <div className="relative" ref={batchSelectRef}>
                  <button
                    type="button"
                    onClick={() => setBatchSelectOpen(!batchSelectOpen)}
                    className={cn(
                      "h-9 w-full flex items-center justify-between rounded-lg border px-3 text-sm text-left transition-colors",
                      "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      "hover:bg-muted/30 cursor-pointer",
                      batchSelectOpen ? "border-ring" : "border-input",
                      isNewBatch && !batchName ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    <span className={cn("truncate", !isNewBatch && !batchName && "text-muted-foreground")}>
                      {!isNewBatch && batchName ? batchName
                        : isNewBatch && batchName ? batchName
                        : isNewBatch ? "Digita nome nuovo batch..."
                        : "Seleziona un batch"}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", batchSelectOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {batchSelectOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden"
                      >
                        <div className="py-1">
                          {batchInfo.batches.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground italic">Nessun batch</div>
                          )}
                          {batchInfo.batches.map(b => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => { handleBatchSelect(b.name); setBatchSelectOpen(false) }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                                "hover:bg-muted/30 cursor-pointer",
                                !isNewBatch && batchName === b.name && "bg-primary/5 text-primary font-medium"
                              )}
                            >
                              <span className="truncate">{b.name}</span>
                              {!isNewBatch && batchName === b.name && (
                                <Check className="h-3.5 w-3.5 shrink-0 ml-auto" />
                              )}
                            </button>
                          ))}
                          <div className="border-t border-border my-1" />
                          <button
                            type="button"
                            onClick={() => { handleBatchSelect('__new__'); setBatchSelectOpen(false) }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                              "hover:bg-muted/30 cursor-pointer",
                              isNewBatch && "bg-primary/5 text-primary font-medium"
                            )}
                          >
                            <span>+ Nuovo batch...</span>
                            {isNewBatch && <Check className="h-3.5 w-3.5 shrink-0 ml-auto" />}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {isNewBatch && (
                  <Input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Nome nuovo batch"
                    autoFocus
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                )}
              </div>
            </div>

            {/* File upload dropzone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">File (Excel o CSV)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
                  dragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : file
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-border hover:border-muted-foreground hover:bg-muted/30"
                )}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                      <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreview([]); }}
                      className="text-xs text-muted-foreground hover:text-red-500 underline underline-offset-2 transition-colors"
                    >
                      Rimuovi file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-secondary/50">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Trascina il file qui o clicca per caricare
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      .xlsx o .csv — Max 5MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {preview.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Anteprima (prime {preview.length} righe)</span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left text-muted-foreground w-8">#</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">Nome</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">Categoria</th>
                        <th className="px-3 py-2 text-left text-muted-foreground">Logo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className={cn("border-t border-border", i % 2 === 0 && "bg-muted/10")}>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-3 py-2 text-foreground font-medium">{row.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.category || <span className="italic text-muted-foreground/60">—</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px] text-xs">{row.image_url || <span className="italic text-muted-foreground/60">—</span>}</td>
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
                className="bg-primary hover:bg-primary/90 text-white w-full sm:w-auto"
              >
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                    Import in corso...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1.5" />
                    Conferma Import
                  </>
                )}
              </Button>
            )}

          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground">Gestione Batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batchInfo.batches.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nessun batch presente</p>
            ) : (
              batchInfo.batches.map(batch => {
                const isActive = batchInfo.activeBatch === batch.name
                return (
                  <div key={batch.name}
                    className={`rounded-lg border transition-colors ${
                      isActive
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card hover:bg-secondary/50'
                    }`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{batch.name}</h3>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Attivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {batch.companyCount} aziende
                            </span>
                            <span className="flex items-center gap-1">
                              <Vote className="h-3.5 w-3.5" />
                              {batch.voteCount} voti
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetActive(batch.name)}
                              className="h-8 text-xs border-border text-foreground hover:bg-secondary">
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Attiva
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(batch)}
                            className="h-8 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Elimina
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
