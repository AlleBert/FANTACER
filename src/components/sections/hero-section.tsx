'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: '100dvh' }}>
      {/* Background - esteso nel notch con absolute inset-0 */}
      <div className="absolute inset-0 bg-white -z-10" />
      <div className="absolute inset-0">
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

      {/* Content - senza padding-top per lasciare che il background copra il notch */}
      <div className="relative z-10 flex w-full flex-col justify-end px-4 pb-4 md:pb-10" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex justify-center">
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