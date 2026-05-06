'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface SelectedStandSectionProps {
  companyName?: string
  onWhyClick?: () => void
}

export function SelectedStandSection({ 
  companyName = "Ceramica Mimma", 
  onWhyClick 
}: SelectedStandSectionProps) {
  return (
    <section className="relative w-full h-[100dvh] bg-white flex flex-col items-center justify-center overflow-hidden pt-8">
      
      <div className="relative z-10 w-full max-w-[1200px] mx-auto text-center px-4 md:px-8">
        {/* Company name */}
        <div className="space-y-12">
          {/* Headline - What do you think of? */}
          <div className="space-y-4">
            <h2 className="text-[clamp(1.5rem,5vw,72px)] font-black text-[#8000ff] tracking-tighter uppercase whitespace-pre-line leading-none">
              cosa ne pensi
              di
            </h2>
            
            {/* Brand/Stand name flanked by stars */}
            <div className="flex items-center justify-center gap-4 md:gap-8">
              <div className="">
                <Image src="/star-decoration-alt.svg" alt="" width={60} height={60} className="w-8 h-8 md:w-20 md:h-20 object-contain drop-shadow-[4px_4px_0_#000] -rotate-12 scale-90" />
              </div>
              <h3 className="text-[clamp(1.5rem,7vw,96px)] font-black text-[#8000ff] border-b-[4px] md:border-b-8 border-[#fccb27] pb-2 tracking-tighter uppercase whitespace-nowrap">
                {companyName}
              </h3>
              <div className="">
                <Image src="/star-decoration.svg" alt="" width={60} height={60} className="w-8 h-8 md:w-20 md:h-20 object-contain drop-shadow-[4px_4px_0_#000] rotate-12" />
              </div>
            </div>
          </div>
          
          {/* CTA transformed into a single-line text input area */}
          <div className="pt-8 flex justify-center w-full">
            <input
              type="text"
              placeholder="PERCHÉ...?"
              className="bg-[#fccb27] focus:bg-white text-black placeholder:text-black/50 text-2xl md:text-4xl font-black px-12 py-6 md:px-20 md:py-8 rounded-full border-[3px] border-black shadow-[6px_6px_0_#000] focus:shadow-[8px_8px_0_#000] focus:-translate-y-1 uppercase tracking-tighter w-full max-w-xl outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 text-center"
            />
          </div>
        </div>
        
        <p className="text-[clamp(1rem,2.5vw,24px)] text-[#231f20] font-[900] mt-8 md:mt-12 uppercase opacity-80 tracking-tight">
          completa il gioco per poter ritirare il premio!
        </p>
      </div>
      
      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        <Image
          src="/star-decoration-alt.svg"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain rotate-12 scale-105"
        />
        <Image
          src="/star-decoration.svg"
          alt=""
          width={130}
          height={127}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain -rotate-6 scale-90"
        />
      </div>
    </section>
  )
}