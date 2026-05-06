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
        {/* Desktop Background */}
        <div className="hidden md:block absolute inset-0">
          <Image
            src="/hero-background.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 100vw, 1vw"
            className="object-cover"
            priority
          />
        </div>
        {/* Mobile Background */}
        <div className="block md:hidden absolute inset-0">
          <Image
            src="/FANTACER_16_9.webp"
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 1vw"
            className="object-cover"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 flex w-full flex-col justify-end safe-shell">
        <div className="flex justify-center pb-4 md:pb-10">
          <Button
            onClick={onPlayClick}
            className="bg-[#fccb27] hover:bg-[#c99900] text-black text-[clamp(1.5rem,5vw,2.5rem)] font-black px-16 py-8 md:px-24 md:py-12 rounded-full border-[3px] border-black shadow-[6px_6px_0_#000] uppercase tracking-tighter"
          >
            GIOCA
          </Button>
        </div>
      </div>
    </section>
  )
}
