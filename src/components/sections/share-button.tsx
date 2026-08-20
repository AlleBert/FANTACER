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
      className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-coral px-7 py-3 font-black uppercase text-white shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0_#000]"
    >
      <Icon className="h-4 w-4 stroke-[2.5]" />
      {copied ? t('success.shareCopied') : t('success.shareButton')}
    </button>
  )
}
