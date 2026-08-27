'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { useLocale } from '@/lib/LocaleContext'

interface SaveButtonProps {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function SaveButton({ containerRef }: SaveButtonProps) {
  const { t } = useLocale()
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
    if (!containerRef.current) return

    setError(null)
    try {
      // html-to-image serializza il nodo in un SVG foreignObject: il browser
      // rende nativamente, quindi i colori moderni (oklab/oklch di Tailwind v4)
      // vengono gestiti senza errori di parsing.
      const dataUrl = await toPng(containerRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = 'fantacer-voto.png'
      link.href = dataUrl
      link.click()

      setSaved(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('SaveButton capture error:', err)
      setError('errore_salvataggio')
      // Clear error after 5 seconds
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
