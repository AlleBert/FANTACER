'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  const handlePlayClick = () => {
    const main = document.querySelector('main');
    // HARDCODED: targets 5th child (SearchSection) in page.tsx — keep in sync with section order
    const target = main?.children[5] as HTMLElement | undefined;
    if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
    onPlayClick?.()
  }

  return (
    <section className="snap-start relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#FF2FB2_0%,#4B00AB_60%,#4B00AB_100%)] flex items-center justify-center overflow-hidden">
      
      <div className="safe-shell h-full flex flex-col">
      <div className="relative z-10 w-full max-w-7xl mx-auto text-center flex flex-col items-center justify-center gap-8 md:gap-12 flex-1">
        <p className="text-[clamp(1.5rem,4vw,2.875rem)] text-white font-medium leading-[1.3] md:leading-[1.4] max-w-[90%] md:max-w-none drop-shadow-[2px_2px_0_#000]">
          puoi giocare una sola volta al giorno
          <br className="hidden md:block" />
          <span className="md:hidden"> </span>
          <span className="font-[900] block mt-2 md:mt-4 md:inline">dal 21 al 25 settembre 2026</span>
        </p>

        <div className="flex flex-col items-center justify-center gap-6 md:gap-8">
          <div className="flex items-center justify-center pointer-events-none">
            <Image
              src="/star-decoration-alt.svg"
              alt=""
              width={83}
              height={82}
              className="w-16 h-16 md:w-[88px] md:h-[88px] lg:w-[95px] lg:h-[95px] object-contain relative z-10 rotate-6"
            />
            <Image
              src="/star-decoration.svg"
              alt=""
              width={81}
              height={79}
              className="w-12 h-12 md:w-[72px] md:h-[72px] lg:w-[70px] lg:h-[70px] object-contain relative z-0 -rotate-12 scale-95 -ml-3 md:-ml-4"
            />
          </div>

          <Button
            onClick={handlePlayClick}
            className="bg-[#fccb27] hover:bg-[#c99900] text-[#000000] text-[clamp(2.25rem,7vw,5.5rem)] font-[900] px-[clamp(4.5rem,11vw,9rem)] py-[clamp(2.25rem,5.5vw,4.5rem)] rounded-full border-[3px] md:border-[4px] border-black transition-transform hover:scale-105 shadow-[6px_6px_0px_0px_#000] uppercase tracking-tight"
          >
            GIOCA
          </Button>
        </div>
      </div>
      </div>
    </section>
  )
}