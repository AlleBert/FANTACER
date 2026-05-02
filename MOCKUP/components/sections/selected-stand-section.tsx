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
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      {/* Background Frame */}
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        {/* Company name */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          {companyName}
        </h2>
        
        {/* Stand preference text */}
        <div className="relative inline-block mb-8">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-normal text-[#8000ff]">
            è il tuo stand preferito!
          </h3>
          <Image
            src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
            alt=""
            width={141}
            height={139}
            className="absolute -top-4 -right-8 md:-right-12 w-20 h-20 md:w-24 md:h-24 object-contain"
          />
        </div>
        
        {/* Why button */}
        <Button
          onClick={onWhyClick}
          className="bg-[#c2e1ff] hover:bg-[#a8c7e6] text-black text-xl md:text-2xl font-bold px-8 md:px-12 py-4 rounded-full border-2 border-[#231f20] mb-6"
        >
          perché?
        </Button>
        
        <p className="text-base md:text-lg lg:text-xl text-gray-700 font-medium">
          completa il gioco per poter ritirare il premio!
        </p>
      </div>
      
      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        <Image
          src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
        <Image
          src="/840edc06-e826-44c6-bba4-2b5d4e2b5b7f@2x.png"
          alt=""
          width={130}
          height={127}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
      </div>
    </section>
  )
}