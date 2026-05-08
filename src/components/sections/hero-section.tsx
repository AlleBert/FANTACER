'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <section className="snap-start relative w-full h-[100dvh] overflow-hidden">
      {/* Background Layer - Riempie tutto, notch incluso */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-background.webp"
          alt=""
          fill
          priority
          className="hidden md:block object-cover"
          sizes="100vw"
        />
        <Image
          src="/FANTACER_16_9.webp"
          alt=""
          fill
          priority
          className="block md:hidden object-cover"
          sizes="100vw"
        />
      </div>

      {/* Content Layer - Gestito dalla tua classe safe-shell */}
      <div className="relative z-10 flex flex-col justify-end safe-shell">
        <div className="flex justify-center">
          <Button
            onClick={onPlayClick}
            className="bg-[#fccb27] hover:bg-[#c99900] text-black text-[clamp(1.5rem,5vw,2.5rem)] font-black px-16 py-8 md:px-24 md:py-12 rounded-full border-[3px] border-black shadow-[6px_6px_0_#000] uppercase tracking-tighter cursor-pointer active:scale-95 transition-transform"
          >
            GIOCA
          </Button>
        </div>
      </div>
    </section>
  )
}
