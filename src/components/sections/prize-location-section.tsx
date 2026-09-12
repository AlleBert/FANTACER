'use client'

import { SectionFrame } from '@/components/layout/section-frame'
import { SafeCenterSection } from '@/components/layout/safe-center-section'
import { useLocale } from '@/lib/LocaleContext'

export function PrizeLocationSection() {
  const { t } = useLocale()
  return (
    <SectionFrame theme="prize-location" className="text-white flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-sec)" className="content-max">
        <h2 className="text-(length:--fs-headline) font-[900] text-orange tracking-tighter lowercase leading-(--lh-headline) text-center md:whitespace-nowrap w-full">
          {t('prize.title')}
        </h2>
        <p className="text-[clamp(1.15rem,3.5vw,2.625rem)] text-center text-white font-medium leading-(--lh-body) max-w-(--measure-body) w-full">
          {t('prize.inside')} <strong className="font-[900]">{t('prize.venue')}</strong>{' '}
          <br />
          <span className="block mt-2 md:mt-4 font-[900]">{t('prize.dates')}</span>
        </p>
      </SafeCenterSection>
    </SectionFrame>
  )
}
