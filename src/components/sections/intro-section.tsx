'use client'

import { ChevronDown } from 'lucide-react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { useLocale } from '@/lib/LocaleContext'

export function IntroSection() {
  const { t } = useLocale()
  return (
    <section className="snap-start relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#FF8C23_0%,#FF2FB2_50%,#4B00AB_100%)]">
      {/* Seamless transition overlay to Section 3 */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-[#FF8A26] pointer-events-none" />

      <div className="safe-shell h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-7xl mx-auto">
          <h1 className="text-[clamp(1.5rem,5dvh,4.5rem)] font-open-sauce font-black text-white tracking-[-0.05em] leading-[1.05] md:leading-[0.9] lowercase max-w-[14ch]">
            {t('intro.title.line1')}<br />
            {t('intro.title.line2')}<br />
            {t('intro.title.line3')}
          </h1>

          <p className="mt-[clamp(0.5rem,1.5dvh,1.5rem)] lg:mt-6 text-[clamp(1rem,3.25dvh,2.25rem)] font-open-sauce font-medium text-white leading-[1.2] [text-wrap:balance] max-w-[20ch]">
            {t('intro.subtitle')}
          </p>

          <SponsorCards className="mt-[clamp(1rem,3.5dvh,3rem)] md:mt-12" />
        </div>

        <div className="flex flex-col items-center gap-2 pb-4 md:pb-6 animate-bounce">
          <span className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-[700] text-white/50 tracking-[0.15em] uppercase">{t('intro.discover')}</span>
          <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-white/50" />
        </div>
      </div>
    </section>
  )
}
