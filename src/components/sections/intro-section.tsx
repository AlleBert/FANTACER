'use client'

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

        <SponsorCards maxItems={maxItems} />
      </SafeCenterSection>
    </SectionFrame>
  )
}
