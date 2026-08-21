'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Check } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useLocale } from '@/lib/LocaleContext'

interface SaveButtonProps {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function SaveButton({ containerRef }: SaveButtonProps) {
  const { t } = useLocale()
  const [saved, setSaved] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const handleSave = async () => {
    if (!containerRef.current) return

    try {
      const canvas = await html2canvas(containerRef.current)
      const link = document.createElement('a')
      link.download = 'fantacer-voto.png'
      link.href = canvas.toDataURL('image/png')
      link.click()

      setSaved(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setSaved(false), 3000)
    } catch {
      return
    }
  }

  const Icon = saved ? Check : Download

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-bright text-ink shadow-[2px_2px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#000] active:translate-y-0.5 active:shadow-[1px_1px_0_#000] focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={saved ? t('success.saveDone') : t('success.saveCta')}
    >
      <Icon className="h-5 w-5 stroke-[2.5]" />
      <span className="sr-only">{saved ? t('success.saveDone') : t('success.saveCta')}</span>
    </button>
  )
}
