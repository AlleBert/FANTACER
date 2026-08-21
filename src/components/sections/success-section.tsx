'use client'

import { useEffect, useRef } from 'react'
import { useVote } from '@/lib/VoteContext'
import confetti from 'canvas-confetti'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'
import { VoteReceipt } from '@/components/sections/vote-receipt'
import { ActionBar } from '@/components/sections/action-bar'

export function SuccessSection() {
  const { selectedCompanies } = useVote()
  const { t } = useLocale()
  const sectionRef = useRef<HTMLDivElement>(null)

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
    <SectionFrame theme="success" grow scrollable className="flex flex-col">
      <div ref={sectionRef} className="safe-shell relative z-10 flex flex-1 min-h-0 flex-col items-center py-(--section-pad)">
        <div className="content-max centered-shell">
          <div className="success-grid gap-(--gap-between-groups)">
            {/* Left Column: Hero + Copy + CTA */}
            <div className="success-grid-col-1 flex flex-col gap-(--space-lg)">
              {/* Hero Section */}
              <div className="flex flex-col gap-(--space-md)">
                <h2 className="-rotate-1 text-(length:--fs-hero) leading-(--lh-display) font-black uppercase tracking-[-0.05em] text-purple [text-wrap:balance]">
                  {t('success.youRock')}
                </h2>
                <div className="hidden sm:flex items-center gap-(--space-md)">
                  <span className="inline-flex -rotate-2 items-center rounded-(--rounded-sm) border-2 border-ink bg-bright px-(--space-md) py-(--space-xs) font-black uppercase text-ink shadow-[3px_3px_0_#000]">
                    {t('success.voted')}
                  </span>
                </div>
              </div>

              {/* Copy Section */}
              <div className="flex flex-col gap-(--space-lg)">
                <p className="max-w-(--measure-body) text-(length:--fs-body) font-black uppercase leading-(--lh-body) text-ink [text-wrap:pretty]">
                  {t('success.shareTaglinePre')}{' '}
                  <span className="inline-block rotate-1 rounded-(--rounded-sm) border-2 border-ink bg-bright px-(--space-sm) py-1 font-black shadow-[2px_2px_0_#000]">
                    @fanta.cer
                  </span>{' '}
                  {t('success.shareTaglinePost')}
                </p>
                <ActionBar containerRef={sectionRef} text={shareText} url={shareUrl} />
              </div>
            </div>

            {/* Right Column: Vote Receipt + Prizes */}
            <div className="success-grid-col-2 flex flex-col gap-(--space-lg)">
              {/* Vote Receipt */}
              <VoteReceipt companies={selectedCompanies} />

              {/* Prizes Section */}
              <div className="flex flex-col gap-(--space-md)">
                <h3 className="text-(length:--fs-label) font-black uppercase tracking-[0.02em] text-ink">
                  {t('success.redeemPrize')}
                </h3>
                <SponsorCards standOnly />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}
