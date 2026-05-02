'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <div className="relative w-full h-[45.956rem] md:h-auto min-h-[80vh] bg-white">
      {/* Background image container */}
      <div className="absolute inset-0 w-full h-[50.075rem]">
        <Image
          src="/Container@2x.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>
      
      {/* CTA Button - positioned to match design */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0">
        <Button
          onClick={onPlayClick}
          className="bg-[#fccb27] hover:bg-[#c99900] text-black text-2xl font-bold px-16 py-4 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
        >
          GIOCA
        </Button>
      </div>
    </div>
  )
}