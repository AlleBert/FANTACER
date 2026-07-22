'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image as ImageIcon, Plus, X } from 'lucide-react'
import { SponsorTable } from '@/components/admin/sponsor-table'

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function SponsorPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Sponsor | null>(null)
  const [form, setForm] = useState({ name: '', image_url: '', website_url: '', sort_order: 0 })

  const loadSponsors = async () => {
    const res = await fetch('/api/admin/sponsors')
    const json = await res.json()
    setSponsors(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/admin/sponsors')
      .then(res => res.json())
      .then(json => {
        setSponsors(json.data || [])
        setLoading(false)
      })
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', image_url: '', website_url: '', sort_order: sponsors.length })
    setShowModal(true)
  }

  const openEdit = (sponsor: Sponsor) => {
    setEditing(sponsor)
    setForm({
      name: sponsor.name,
      image_url: sponsor.image_url || '',
      website_url: sponsor.website_url || '',
      sort_order: sponsor.sort_order,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name) return

    const body = editing
      ? { ...form, id: editing.id }
      : form

    const res = await fetch('/api/admin/sponsors', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setShowModal(false)
      loadSponsors()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo sponsor?')) return
    await fetch(`/api/admin/sponsors?id=${id}`, { method: 'DELETE' })
    loadSponsors()
  }

  const handleToggleActive = async (sponsor: Sponsor) => {
    await fetch('/api/admin/sponsors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sponsor, is_active: !sponsor.is_active }),
    })
    loadSponsors()
  }

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-foreground tracking-tight">Sponsor</h1>
          <p className="text-[clamp(0.75rem,2.5vw,1rem)] text-muted-foreground">Gestione sponsor e partner</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 min-h-[36px] text-[clamp(0.75rem,2vw,0.875rem)] font-medium text-white hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nuovo Sponsor
        </button>
      </header>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-[clamp(1rem,3vw,1.25rem)] flex items-center gap-2">

        
            <ImageIcon className="h-5 w-5" />
            Elenco Sponsor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : sponsors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nessuno sponsor presente. Clicca &quot;Nuovo Sponsor&quot; per aggiungerne uno.</div>
          ) : (
            <div className="lg:hidden">
              {sponsors.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border-b border-black/5">
                  <div className="flex items-center gap-3">
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} className="w-10 h-10 object-contain rounded border border-black/10" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">No</div>
                    )}
                    <div>
                      <p className="font-bold text-[clamp(0.8rem,2.5vw,1rem)]">{s.name}</p>
                      <p className="text-[clamp(0.65rem,2vw,0.8rem)] text-muted-foreground">{s.is_active ? 'Attivo' : 'Disattivo'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)} className="px-3 py-2.5 text-[clamp(0.65rem,2vw,0.8rem)] text-[#8000ff] font-bold rounded-lg border border-[#8000ff]/20 hover:bg-[#8000ff]/5">MODIFICA</button>
                    <button onClick={() => handleDelete(s.id)} className="px-3 py-2.5 text-[clamp(0.65rem,2vw,0.8rem)] text-red-500 font-bold rounded-lg border border-red-500/20 hover:bg-red-500/5">ELIMINA</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="hidden lg:block">
            <SponsorTable sponsors={sponsors} onEdit={openEdit} onDelete={handleDelete} onToggleActive={handleToggleActive} />
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{editing ? 'Modifica Sponsor' : 'Nuovo Sponsor'}</h3>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nome *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">URL Logo</label>
                <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">URL Sito Web</label>
                <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Ordine</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                  Annulla
                </button>
                <button onClick={handleSave} disabled={!form.name}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {editing ? 'Salva' : 'Crea'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
