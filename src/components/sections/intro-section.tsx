'use client'

import { ChevronDown } from 'lucide-react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { SectionFrame } from '@/components/layout/section-frame'
import { SafeCenterSection } from '@/components/layout/safe-center-section'
import { useLocale } from '@/lib/LocaleContext'
import { useSponsorMaxItems } from '@/hooks/use-sponsor-max-items'

export function IntroSection() {
  const { t } = useLocale()
  const maxItems = useSponsorMaxItems()
  return (
    <SectionFrame theme="intro" className="flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-blk)" className="max-w-7xl mx-auto text-center">
        <h1 className="text-(length:--fs-display) font-open-sauce font-black text-white tracking-[-0.05em] leading-(--lh-display) lowercase w-full max-w-(--measure-display) [text-wrap:balance]">
          {t('intro.title.line1')}{' '}<br />
          {t('intro.title.line2')}{' '}<br />
          {t('intro.title.line3')}
        </h1>

        <p className="text-[clamp(0.875rem,min(3.25vw,4.5svh),2.25rem)] font-open-sauce font-medium text-white leading-(--lh-body) [text-wrap:balance] max-w-(--measure-body)">
          {t('intro.subtitle')}
        </p>

        <div className="mt-(--rythm-blk)">
          <SponsorCards maxItems={maxItems} />
        </div>
      </SafeCenterSection>

      {/* Footer: Chevron */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2 pb-(--space-md) animate-bounce">
        <span className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-[700] text-white/50 tracking-[0.15em] uppercase">{t('intro.discover')}</span>
        <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-white/50" />
      </div>
    </SectionFrame>
  )
}
