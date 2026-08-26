'use client'

import Image from 'next/image'
import { ChevronsDown } from 'lucide-react'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'

interface HeroSectionProps {
  onScrollDown?: () => void
}

export function HeroSection({ onScrollDown }: HeroSectionProps) {
  const { t } = useLocale()
  return (
    <SectionFrame theme="hero">
      {/* Background Layer - Riempie tutto, notch incluso */}
      <div className="absolute inset-0 z-0">
        <picture className="absolute inset-0">
          <source
            media="(orientation: portrait)"
            srcSet="/FANTACER_16_9.webp"
          />
          <Image
            src="/hero-background.webp"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </picture>
      </div>

      {/* Content Layer - Gestito dalla tua classe safe-shell */}
      <div className="relative z-10 flex flex-col justify-between safe-shell">
        <div className="pt-2" />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onScrollDown}
            aria-label={t('hero.scroll')}
            className="flex items-center justify-center w-[clamp(3rem,10svh,4rem)] h-[clamp(3rem,10svh,4rem)] rounded-full bg-bright border-[3px] md:border-[4px] border-black shadow-[6px_6px_0_#000] transition-transform hover:scale-105 active:scale-95 cursor-pointer animate-bounce motion-reduce:animate-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <ChevronsDown
              className="w-[clamp(1.75rem,6svh,2.5rem)] h-[clamp(1.75rem,6svh,2.5rem)] stroke-black stroke-[3]"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </SectionFrame>
  )
}
