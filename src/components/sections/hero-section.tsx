'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-white">
      <div className="absolute inset-0">
        <Image
          src="/hero-background.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="relative z-10 flex w-full flex-col justify-end safe-shell">
        <div className="flex justify-center pb-4 md:pb-10">
          <Button
            onClick={onPlayClick}
            className="bg-[#fccb27] hover:bg-[#c99900] text-black text-2xl md:text-4xl font-black px-16 py-8 md:px-24 md:py-12 rounded-full border-2 border-black shadow-[4px_4px_0_#000] uppercase tracking-tighter"
          >
            GIOCA
          </Button>
        </div>
      </div>
    </section>
  )
}
