'use client'

import Image from 'next/image'
import { CtaButton } from '@/components/ui/cta-button'
import { SectionFrame } from '@/components/layout/section-frame'
import { SafeCenterSection } from '@/components/layout/safe-center-section'
import { useLocale } from '@/lib/LocaleContext'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  const { t } = useLocale()
  const handlePlayClick = () => {
    const main = document.querySelector('main');
    const target = main?.querySelector('[data-section="search"]') as HTMLElement | undefined;
    if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    onPlayClick?.()
  }

  return (
    <SectionFrame theme="play-again" className="flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-sec)" className="content-max text-center">
        <p className="text-[clamp(1.125rem,3.5vw,2.875rem)] text-white font-medium leading-(--lh-body) max-w-(--measure-body)">
          {t('playAgain.text')}
          <br className="hidden md:block" />
          <span className="md:hidden"> </span>
          <span className="font-[900] block mt-2 md:mt-4 md:inline">{t('playAgain.dates')}</span>
        </p>

        <div className="flex flex-col items-center justify-center gap-[clamp(0.5rem,2svh,2rem)] md:gap-8">
          <div className="flex items-center justify-center pointer-events-none">
            <Image
              src="/star-decoration-alt.svg"
              alt=""
              width={83}
              height={82}
              className="w-[clamp(2.5rem,9svh,4rem)] h-[clamp(2.5rem,9svh,4rem)] md:w-[88px] md:h-[88px] lg:w-[95px] lg:h-[95px] object-contain relative z-10 rotate-6"
            />
            <Image
              src="/star-decoration.svg"
              alt=""
              width={81}
              height={79}
              className="w-[clamp(1.75rem,7svh,3rem)] h-[clamp(1.75rem,7svh,3rem)] md:w-[72px] md:h-[72px] lg:w-[70px] lg:h-[70px] object-contain relative z-0 -rotate-12 scale-95 -ml-3 md:-ml-4"
            />
          </div>

          <CtaButton onClick={handlePlayClick} scale={1.15}>{t('hero.play')}</CtaButton>
        </div>
      </SafeCenterSection>
    </SectionFrame>
  )
}
