'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Check } from 'lucide-react'
import { toPng } from 'html-to-image'
import { useLocale } from '@/lib/LocaleContext'
import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'
import { resolveCustomPropertySizes } from '@/lib/resolve-capture-sizes'

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
    const root = containerRef.current
    if (!root) return

    // Cattura la <section> (contenitore di scroll) invece del div interno, così
    // l'immagine coincide col viewport visibile. Il gradiente vive in
    // BackgroundLayer (sibling fixed fuori dal subtree): lo applichiamo via
    // `style.background` sul nodo clonato, derivando il tema dal data-section.
    const section = root.closest('section[data-section]') as HTMLElement | null
    const target = section ?? root
    const themeKey = target.getAttribute('data-section') as SectionThemeKey | null
    const background = themeKey ? sectionThemes[themeKey]?.background : undefined

    setError(null)
    // html-to-image non serializza le CSS custom properties: risolviamo le
    // dimensioni delle card sponsor in px prima della cattura e le ripristiniamo
    // dopo (try/finally).
    const restoreSizes = resolveCustomPropertySizes(target)
    try {
      // html-to-image serializza il nodo in un SVG foreignObject: il browser
      // rende nativamente, quindi i colori moderni (oklab/oklch di Tailwind v4)
      // vengono gestiti senza errori di parsing.
      const dataUrl = await toPng(target, {
        pixelRatio: 1,
        width: target.clientWidth,
        height: target.clientHeight,
        style: background ? { background } : undefined,
        cacheBust: false,
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
    } finally {
      restoreSizes()
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