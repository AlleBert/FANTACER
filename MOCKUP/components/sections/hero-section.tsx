'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <div className="relative w-full min-h-[45.956rem] bg-white flex flex-col">
      <div className="relative w-full h-[50.075rem] overflow-hidden">
        <Image
          src="/Container@2x.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            onClick={onPlayClick}
            className="bg-mockup-yellow hover:bg-[#c99900] text-black text-2xl md:text-3xl font-bold px-12 py-6 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
          >
            GIOCA
          </Button>
        </div>
      </div>
    </div>
  )
}