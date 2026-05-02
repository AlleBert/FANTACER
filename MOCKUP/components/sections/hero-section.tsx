'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <section className="relative w-full h-[100dvh] bg-white flex flex-col justify-end overflow-hidden">
      {/* Background image container */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src="/hero-background.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>
      
      {/* CTA Button - positioned to match design */}
      <div className="relative z-10 flex justify-center pb-12 md:pb-24">
        <Button
          onClick={onPlayClick}
          className="bg-[#fccb27] hover:bg-[#c99900] text-black text-2xl md:text-4xl font-black px-16 py-8 md:px-24 md:py-12 rounded-full border-2 border-black shadow-[4px_4px_0_#000] uppercase tracking-tighter"
        >
          GIOCA
        </Button>
      </div>
    </section>
  )
}