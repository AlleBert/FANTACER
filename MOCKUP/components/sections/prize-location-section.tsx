'use client'

import Image from 'next/image'

export function PrizeLocationSection() {
  return (
    <section className="relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#4B00AB_0%,#4B00AB_30%,#8A2BE2_60%,#E0B0FF_85%,#FFFFFF_100%)] text-white flex flex-col items-center justify-center overflow-hidden pt-8">
      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center">
        {/* Main Title - Responsive & Lowercase */}
        <h2 className="text-[clamp(2.5rem,7.5vw,91px)] font-[900] text-[#ff803b] tracking-tighter lowercase leading-[1.1] mb-12 lg:mb-20 text-center md:whitespace-nowrap w-full">
          e ritira il tuo premio qui
        </h2>
        
        {/* Logos container */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-10 md:gap-20 mb-8 md:mb-12">
          {/* Card 1 (Empty for Logo) */}
          <div className="relative w-40 h-40 md:w-56 md:h-56 bg-white rounded-3xl md:rounded-[2.5rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden">
            <span className="text-gray-300 font-bold select-none opacity-50">Image 1</span>
          </div>
          {/* Card 2 (Empty for Logo) */}
          <div className="relative w-40 h-40 md:w-56 md:h-56 bg-white rounded-3xl md:rounded-[2.5rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden">
            <span className="text-gray-300 font-bold select-none opacity-50">Image 2</span>
          </div>
        </div>

        {/* Adaptive Subtitle text */}
        <p className="text-[clamp(1.125rem,3.5vw,42px)] text-center text-white font-medium leading-[1.3] md:leading-[1.4] max-w-[95%] w-full drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          all&apos;interno di <strong className="font-[900]">Cersaie, a Bologna Fiere</strong>,
          <br className="hidden md:block" />
          <span className="md:hidden"> </span>
          <span className="block mt-2 md:mt-4 font-[900] md:inline">dal 21 al 25 settembre 2026</span>
        </p>
      </div>
    </section>
  )
}