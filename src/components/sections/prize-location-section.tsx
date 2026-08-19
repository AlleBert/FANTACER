'use client'

import { useEffect, useState } from 'react'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { createClient } from '@/lib/supabase/client'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'

export function PrizeLocationSection() {
  const { t } = useLocale()
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('prize-location-sponsors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
        setRefreshKey((k) => k + 1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <SectionFrame theme="prize-location" className="text-white flex flex-col items-center justify-center">
      <div className="safe-shell content-max flex flex-col items-center justify-center h-full gap-(--rythm-sec)">

        <h2 className="text-(length:--fs-headline) font-[900] text-orange tracking-tighter lowercase leading-(--lh-headline) text-center md:whitespace-nowrap w-full">
          {t('prize.title')}
        </h2>

        <SponsorCards variant="large" standOnly refreshKey={refreshKey} />

        <p className="text-[clamp(1.15rem,3.5vw,2.625rem)] text-center text-white font-medium leading-(--lh-body) max-w-(--measure-body) w-full">
          {t('prize.inside')} <strong className="font-[900]">{t('prize.venue')}</strong>{' '}
          <br />
          <span className="block mt-2 md:mt-4 font-[900]">{t('prize.dates')}</span>
        </p>

      </div>
    </SectionFrame>
  )
}
