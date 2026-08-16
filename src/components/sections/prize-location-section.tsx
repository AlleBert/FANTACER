'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { createClient } from '@/lib/supabase/client'

interface StandSponsor {
  id: string
  name: string
  image_url: string | null
  website_url: string | null
  has_stand: boolean
}

export function PrizeLocationSection() {
  const { t } = useLocale()
  const [standSponsors, setStandSponsors] = useState<StandSponsor[] | null>(null)

  useEffect(() => {
    const loadStandSponsors = () => {
      fetch('/api/public/sponsors')
        .then((res) => res.json())
        .then((data) => {
          setStandSponsors((data.sponsors || []).filter((s: StandSponsor) => s.has_stand))
        })
        .catch(() => setStandSponsors([]))
    }

    loadStandSponsors()

    const supabase = createClient()
    const channel = supabase
      .channel('prize-location-sponsors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
        loadStandSponsors()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const sponsors = standSponsors ?? []

  return (
    <SectionFrame theme="prize-location" className="text-white flex flex-col items-center justify-center">
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-col items-center justify-center h-full py-8 md:py-12 gap-6 md:gap-8">

        {/* Main Title */}
        <h2 className="text-[clamp(2rem,6vw,4.5rem)] font-[900] text-orange tracking-tighter lowercase leading-[1.1] text-center md:whitespace-nowrap w-full">
          {t('prize.title')}
        </h2>

        {/* Logo Cards — side by side, big on mobile */}
        <div className="flex flex-row flex-wrap justify-center items-center gap-6 sm:gap-8 md:gap-12">
          {sponsors.length > 0
            ? sponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 max-h-[20svh] bg-white rounded-3xl md:rounded-4xl shadow-[6px_6px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2"
                >
                  {sponsor.image_url ? (
                    <Image
                      src={sponsor.image_url}
                      alt={sponsor.name}
                      fill
                      sizes="(max-width: 480px) 144px, (max-width: 768px) 176px, 208px"
                      className="object-contain p-3 md:p-4"
                    />
                  ) : (
                    <span className="text-black/60 font-black text-sm text-center px-2">{sponsor.name}</span>
                  )}
                </div>
              ))
            : (
              <>
                {/* Card 1 (Ready for Logo) */}
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 max-h-[20svh] bg-white rounded-3xl md:rounded-4xl shadow-[6px_6px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
                </div>
                {/* Card 2 (Ready for Logo) */}
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 max-h-[20svh] bg-white rounded-3xl md:rounded-4xl shadow-[6px_6px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
                </div>
              </>
            )}
        </div>

        {/* Subtitle */}
        <p className="text-[clamp(1.15rem,3.5vw,2.625rem)] text-center text-white font-medium leading-[1.4] max-w-[92%] w-full">
          {t('prize.inside')} <strong className="font-[900]">{t('prize.venue')}</strong>{' '}
          <br />
          <span className="block mt-2 md:mt-4 font-[900]">{t('prize.dates')}</span>
        </p>

      </div>
    </SectionFrame>
  )
}