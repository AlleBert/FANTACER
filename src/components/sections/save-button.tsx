'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Check } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'
import type { SelectedCompany } from '@/lib/VoteContext'

interface SaveButtonProps {
  companies: SelectedCompany[]
}

export function SaveButton({ companies }: SaveButtonProps) {
  const { t, locale } = useLocale()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const handleSave = async () => {
    if (companies.length !== 3) return

    setError(null)
    try {
      // Share card generata server-side con next/og (Satori): zero DOM capture,
      // zero CORS sui logo, font bundle, deterministico su desktop e mobile.
      const params = new URLSearchParams({
        c1: companies[0].company.id,
        c2: companies[1].company.id,
        c3: companies[2].company.id,
        p1: String(companies[0].pallet),
        p2: String(companies[1].pallet),
        p3: String(companies[2].pallet),
        lang: locale,
      })
      const res = await fetch(`/api/share/vote?${params.toString()}`)
      if (!res.ok) throw new Error(`share card ${res.status}`)
      const blob = await res.blob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = 'fantacer-story.png'
      link.href = url
      link.click()
      URL.revokeObjectURL(url)

      setSaved(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('SaveButton fetch error:', err)
      setError('errore_salvataggio')
      const id = window.setTimeout(() => setError(null), 5000)
      return () => window.clearTimeout(id)
    }
  }

  const Icon = saved ? Check : Download

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      className="inline-flex cursor-pointer items-center justify-center rounded-(--rounded-full) border-[3px] border-ink bg-bright px-(--space-lg) py-(--space-sm) shadow-[4px_4px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-y-0.5 active:shadow-[2px_2px_0_#000] focus-visible:ring-3 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={saved ? t('success.saveDone') : t('success.saveCta')}
    >
      <Icon className="h-5 w-5 stroke-[2.5]" />
      <span className="sr-only">{saved ? t('success.saveDone') : t('success.saveCta')}</span>
      {error && (
        <span className="absolute -top-1 -right-1 bg-red-100 text-red-800 text-xs rounded px-2 py-1">
          {error}
        </span>
      )}
    </button>
  )
}
