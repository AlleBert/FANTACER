'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  return (
    <section className="relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#FF2FB2_0%,#4B00AB_60%,#4B00AB_100%)] flex items-center justify-center overflow-hidden">
      
      <div className="relative z-10 w-full max-w-[1200px] mx-auto text-center px-4 md:px-8 flex flex-col items-center justify-center min-h-[50vh]">
        {/* Button Wrapper */}
        <div className="relative inline-flex mb-[clamp(3rem,10vh,6rem)]">
          {/* Overlapping Stars (Top Left offset) */}
          <div className="absolute -top-[10%] -left-[10%] md:-top-[20%] md:-left-[15%] flex items-center -space-x-3 md:-space-x-5 z-20 pointer-events-none -rotate-12">
            <Image
              src="/decoration-flower.png"
              alt=""
              width={83}
              height={82}
              className="w-14 h-14 md:w-20 md:h-20 lg:w-[85px] lg:h-[85px] object-contain relative z-10"
            />
            <Image
              src="/decoration-flower-alt.png"
              alt=""
              width={81}
              height={79}
              className="w-10 h-10 md:w-16 md:h-16 lg:w-[65px] lg:h-[65px] object-contain relative z-0"
            />
          </div>

          <Button
            onClick={onPlayClick}
            className="bg-[#c2e1ff] hover:bg-[#a8c7e6] text-[#000000] text-[clamp(2rem,6vw,80px)] font-[900] px-[clamp(4rem,10vw,8rem)] py-[clamp(2rem,5vw,4rem)] rounded-full border-[3px] md:border-[4px] border-black transition-transform hover:scale-105 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] uppercase tracking-tight"
          >
            GIOCA
          </Button>
        </div>
        
        <p className="text-[clamp(1.25rem,3.5vw,42px)] text-white font-medium leading-[1.3] md:leading-[1.4] max-w-[90%] md:max-w-none">
          puoi giocare una sola volta al giorno
          <br className="hidden md:block" />
          <span className="md:hidden"> </span>
          <span className="font-[900] block mt-2 md:mt-4 md:inline">dal 21 al 25 settembre 2026</span>
        </p>
      </div>
    </section>
  )
}