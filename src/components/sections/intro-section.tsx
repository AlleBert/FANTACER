'use client'

import { ChevronDown } from 'lucide-react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'

export function IntroSection() {
  const { t } = useLocale()
  return (
    <SectionFrame theme="intro">
      {/* Seamless transition overlay to Section 3 */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-orange pointer-events-none" />

      <div className="safe-shell h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-7xl mx-auto">
          <h1 className="text-[clamp(1.25rem,min(5vw,7.5svh),4.5rem)] font-open-sauce font-black text-white tracking-[-0.05em] leading-[1.08] lowercase w-full max-w-[min(90vw,42rem)] [text-wrap:balance]">
            {t('intro.title.line1')}{' '}<br />
            {t('intro.title.line2')}{' '}<br />
            {t('intro.title.line3')}
          </h1>

          <p className="mt-[clamp(0.5rem,1.5vw,1.5rem)] lg:mt-6 text-[clamp(0.875rem,min(3.25vw,4.5svh),2.25rem)] font-open-sauce font-medium text-white leading-[1.4] [text-wrap:balance] max-w-[20ch]">
            {t('intro.subtitle')}
          </p>

          <SponsorCards className="mt-[clamp(1rem,3.5svh,3rem)] md:mt-[min(2.5rem,5svh)]" />
        </div>

        <div className="flex flex-col items-center gap-2 pb-2 md:pb-4 animate-bounce">
          <span className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-[700] text-white/50 tracking-[0.15em] uppercase">{t('intro.discover')}</span>
          <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-white/50" />
        </div>
      </div>
    </SectionFrame>
  )
}
