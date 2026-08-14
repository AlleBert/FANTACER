'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/LocaleContext'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  const { t } = useLocale()
  return (
    <section className="snap-screen relative w-full overflow-hidden">
      {/* Background Layer - Riempie tutto, notch incluso */}
      <div className="absolute inset-0 z-0">
        <picture className="absolute inset-0">
          <source
            media="(orientation: portrait)"
            srcSet="/FANTACER_16_9.webp"
          />
          <Image
            src="/hero-background.webp"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </picture>
      </div>

      {/* Content Layer - Gestito dalla tua classe safe-shell */}
      <div className="relative z-10 flex flex-col justify-end safe-shell">
        <div className="flex justify-center">
          <Button
            onClick={onPlayClick}
            className="bg-bright hover:bg-[#c99900] text-black text-[clamp(1.5rem,5vw,2.5rem)] font-black px-16 py-8 md:px-24 md:py-12 rounded-full border-[3px] border-black shadow-[6px_6px_0_#000] uppercase tracking-tighter cursor-pointer active:scale-95 transition-transform"
          >
            {t('hero.play')}
          </Button>
        </div>
      </div>
    </section>
  )
}
