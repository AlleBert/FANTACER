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
    <SectionFrame theme="success" grow className="flex flex-col">
      <div className="safe-shell relative z-10 flex flex-1 min-h-0 flex-col items-center justify-center py-(--section-pad)">
        <div className="content-max flex w-full flex-col gap-(--space-2xl) lg:grid lg:grid-cols-[1fr_420px] lg:gap-x-(--space-2xl) lg:gap-y-0">
          {/* Left Column: Hero + Copy + CTA */}
          <div className="flex flex-col gap-(--space-xl) lg:col-start-1 lg:row-start-1">
            {/* Hero Section */}
            <div className="flex flex-col gap-(--space-md)">
              <h2 className="-rotate-1 text-(length:--fs-headline) leading-(--lh-display) font-black uppercase tracking-[-0.05em] text-purple">
                {t('success.youRock')}
              </h2>
              <div className="flex items-center gap-(--space-md)">
                <span className="inline-flex -rotate-2 items-center rounded-(--rounded-sm) border-2 border-ink bg-bright px-(--space-md) py-(--space-xs) font-black uppercase text-ink shadow-[3px_3px_0_#000]">
                  {t('success.voted')}
                </span>
              </div>
            </div>

            {/* Copy Section */}
            <div className="flex flex-col gap-(--space-lg)">
              <p className="max-w-(--measure-body) text-(length:--fs-body) font-black uppercase leading-(--lh-body) text-ink">
                {t('success.shareTaglinePre')}{' '}
                <span className="inline-block rotate-1 rounded-(--rounded-sm) border-2 border-ink bg-bright px-(--space-sm) py-1 font-black shadow-[2px_2px_0_#000]">
                  @fanta.cer
                </span>{' '}
                {t('success.shareTaglinePost')}
              </p>
              <ShareButton text={shareText} url={shareUrl} />
            </div>
          </div>

          {/* Right Column: Vote Receipt + Prizes + Social */}
          <div className="flex flex-col gap-(--space-xl) lg:col-start-2 lg:row-start-1">
            {/* Vote Receipt */}
            <VoteReceipt companies={selectedCompanies} />

            {/* Prizes Section */}
            <div className="flex flex-col gap-(--space-md)">
              <h3 className="text-(length:--fs-label) font-black uppercase tracking-[0.02em] text-ink/70">
                {t('success.redeemPrize')}
              </h3>
              <SponsorCards standOnly />
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-(--space-md) lg:mt-auto">
              <SocialLinksRow instagramUrl={INSTAGRAM_URL} facebookUrl={FACEBOOK_URL} />
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}
