'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'

interface ShareButtonProps {
  text: string
  url: string
}

export function ShareButton({ text, url }: ShareButtonProps) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    },
    []
  )

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text, url })
      } catch {
        return
      }
      return
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setCopied(false), 3000)
    } catch {
      return
    }
  }

  const Icon = copied ? Check : Share2

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="inline-flex cursor-pointer items-center gap-(--space-sm) rounded-(--rounded-full) border-[3px] border-ink bg-bright px-(--space-lg) py-(--space-sm) text-(length:--fs-body) font-black uppercase text-ink shadow-[4px_4px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] active:translate-y-0.5 active:shadow-[2px_2px_0_#000] focus-visible:ring-3 focus-visible:ring-purple focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Icon className="h-5 w-5 stroke-[2.5]" />
      {copied ? t('success.shareCopied') : t('success.shareCta')}
    </button>
  )
}
