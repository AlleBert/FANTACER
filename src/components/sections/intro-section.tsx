'use client'

import { ChevronDown } from 'lucide-react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'

export function IntroSection() {
  const { t } = useLocale()
  return (
    <SectionFrame theme="intro">
      <div className="safe-shell h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-7xl mx-auto">
          <h1 className="text-(length:--fs-display) font-open-sauce font-black text-white tracking-[-0.05em] leading-(--lh-display) lowercase w-full max-w-(--measure-display) [text-wrap:balance]">
            {t('intro.title.line1')}{' '}<br />
            {t('intro.title.line2')}{' '}<br />
            {t('intro.title.line3')}
          </h1>

          <p className="mt-(--rythm-blk) lg:mt-(--space-lg) text-[clamp(0.875rem,min(3.25vw,4.5svh),2.25rem)] font-open-sauce font-medium text-white leading-(--lh-body) [text-wrap:balance] max-w-(--measure-body)">
            {t('intro.subtitle')}
          </p>

          <SponsorCards className="mt-(--rythm-sec) md:mt-(--space-2xl)" />
        </div>

        <div className="flex flex-col items-center gap-2 pb-2 md:pb-4 animate-bounce">
          <span className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-[700] text-white/50 tracking-[0.15em] uppercase">{t('intro.discover')}</span>
          <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-white/50" />
        </div>
      </div>
    </SectionFrame>
  )
}
