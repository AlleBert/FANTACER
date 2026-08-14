'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  const { t } = useLocale()
  const handlePlayClick = () => {
    const main = document.querySelector('main');
    // HARDCODED: targets 5th child (SearchSection) in page.tsx — keep in sync with section order
    const target = main?.children[5] as HTMLElement | undefined;
    if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    onPlayClick?.()
  }

  return (
    <SectionFrame theme="play-again" className="flex items-center justify-center">
      
      <div className="safe-shell h-full flex flex-col">
      <div className="relative z-10 w-full max-w-7xl mx-auto text-center flex flex-col items-center justify-center gap-[clamp(0.75rem,2.5svh,3rem)] md:gap-12 flex-1">
        <p className="text-[clamp(1.125rem,3.5vw,2.875rem)] text-white font-medium leading-[1.4] max-w-[90%] md:max-w-none">
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

          <Button
            onClick={handlePlayClick}
            className="bg-bright hover:bg-[#c99900] text-[#000000] text-[clamp(1.25rem,min(5.5vw,8vw),5.5rem)] font-[900] px-[clamp(2rem,min(11vw,9vw),9rem)] py-[clamp(1.25rem,4.5vw,4.5rem)] rounded-full border-[3px] md:border-[4px] border-black transition-transform hover:scale-105 shadow-[6px_6px_0px_0px_#000] uppercase tracking-tight"
          >
            {t('hero.play')}
          </Button>
        </div>
      </div>
      </div>
    </SectionFrame>
  )
}