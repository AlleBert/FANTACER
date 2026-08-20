'use client'

import { useEffect } from 'react'
import { useVote } from '@/lib/VoteContext'
import confetti from 'canvas-confetti'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { VoteReceipt } from '@/components/sections/vote-receipt'
import { ShareButton } from '@/components/sections/share-button'
import { SocialLinksRow } from '@/components/sections/social-links-row'
import { INSTAGRAM_URL, FACEBOOK_URL } from '@/lib/social-links'

export function SuccessSection() {
  const { selectedCompanies } = useVote()
  const { t } = useLocale()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const colors = ['#fccb27', '#8000ff', '#ff803b', '#4B00AB', '#ffffff']

    const timer = setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { y: 0.6 },
        colors,
      })

      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 120,
          origin: { y: 0.5 },
          colors,
        })
      }, 1000)
    }, 600)

    return () => clearTimeout(timer)
  }, [])

  const shareText = `${t('success.shareTaglinePre')} @fanta.cer ${t('success.shareTaglinePost')}`
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <SectionFrame theme="success" grow className="flex flex-col justify-between">
      <div className="safe-shell relative z-10 flex flex-1 min-h-0 flex-col items-center justify-center gap-(--rythm-sec) py-(--section-pad)">
        <div className="flex w-full max-w-(--content-max) flex-col items-center gap-(--space-lg) text-center lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-20 lg:gap-y-12 lg:text-left">
          <div className="flex flex-col items-center gap-(--space-lg) lg:col-start-1 lg:row-start-1 lg:items-start">
            <h2 className="text-(length:--fs-headline) leading-(--lh-display) font-black text-purple uppercase tracking-tighter">
              {t('success.youRock')}
            </h2>
            <p className="-rotate-2 rounded-xl border-2 border-ink bg-bright px-4 py-1.5 font-black uppercase text-ink shadow-[3px_3px_0_#000]">
              {t('success.voted')}
            </p>
          </div>

          <div className="flex w-full justify-center lg:col-start-2 lg:row-start-1 lg:justify-center">
            <VoteReceipt companies={selectedCompanies} />
          </div>

          <div className="flex flex-col items-center gap-5 lg:col-start-1 lg:row-start-2 lg:items-start">
            <p className="max-w-(--measure-wide) text-base font-[800] uppercase leading-relaxed text-ink sm:text-lg md:text-xl">
              {t('success.shareTaglinePre')}{' '}
              <span className="inline-block rotate-1 rounded-lg border-2 border-ink bg-bright px-2 py-0.5 font-black shadow-[2px_2px_0_#000]">
                @fanta.cer
              </span>{' '}
              {t('success.shareTaglinePost')}
            </p>
            <ShareButton text={shareText} url={shareUrl} />
          </div>

          <div className="flex w-full justify-center lg:col-start-2 lg:row-start-2 lg:justify-center">
            <SponsorCards standOnly />
          </div>

          <div className="flex w-full items-center justify-center lg:col-start-2 lg:row-start-3 lg:justify-center">
            <SocialLinksRow instagramUrl={INSTAGRAM_URL} facebookUrl={FACEBOOK_URL} />
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}
