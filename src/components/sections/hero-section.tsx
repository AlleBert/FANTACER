'use client'

import Image from 'next/image'
import { CtaButton } from '@/components/ui/cta-button'
import { SectionFrame } from '@/components/layout/section-frame'
import { useLocale } from '@/lib/LocaleContext'

interface HeroSectionProps {
  onPlayClick?: () => void
}

export function HeroSection({ onPlayClick }: HeroSectionProps) {
  const { t } = useLocale()
  return (
    <SectionFrame theme="hero">
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
          <CtaButton onClick={onPlayClick}>{t('hero.play')}</CtaButton>
        </div>
      </div>
    </SectionFrame>
  )
}
