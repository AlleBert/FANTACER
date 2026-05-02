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
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-mockup-purple">
          {companyName}
        </h2>
        
        <div className="relative inline-block mb-8">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-normal text-mockup-purple">
            è il tuo stand preferito!
          </h3>
          <Image
            src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
            alt=""
            width={141}
            height={139}
            className="absolute -top-8 -right-16 w-24 h-24 object-contain"
          />
        </div>
        
        <Button
          onClick={onWhyClick}
          className="bg-mockup-blue hover:bg-[#a8c7e6] text-black text-xl md:text-2xl font-bold px-8 py-4 rounded-full border-2 border-[#231f20] mb-6"
        >
          perché?
        </Button>
        
        <p className="text-lg md:text-xl text-gray-700 font-medium">
          completa il gioco per poter ritirare il premio!
        </p>
      </div>
      
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={134}
        height={132}
        className="absolute left-16 top-1/2 w-24 h-24 -translate-y-1/2 object-contain hidden md:block"
      />
    </section>
  )
}