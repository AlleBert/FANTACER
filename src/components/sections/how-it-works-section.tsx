'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Heart, Smartphone, AtSign, Gift } from 'lucide-react'
import { SectionFrame } from '@/components/layout/section-frame'
import { SafeCenterSection } from '@/components/layout/safe-center-section'
import { useLocale } from '@/lib/LocaleContext'

interface Step {
  icon: ReactNode
  labelKey: 'howItWorks.step.vote' | 'howItWorks.step.share' | 'howItWorks.step.collect'
}

const cardSizeClasses = 'w-(--card-size) aspect-square'

const iconSizeClasses = [
  'w-[clamp(1.75rem,9svh,2.5rem)] h-[clamp(1.75rem,9svh,2.5rem)] md:w-[72px] md:h-[72px] lg:w-20 lg:h-20',
  'w-[clamp(1.75rem,9svh,2.5rem)] h-[clamp(1.75rem,9svh,2.5rem)] md:w-[72px] md:h-[72px] lg:w-20 lg:h-20',
  'w-[clamp(1.75rem,9svh,2.5rem)] h-[clamp(1.75rem,9svh,2.5rem)] md:w-[72px] md:h-[72px] lg:w-20 lg:h-20',
]

const steps: Step[] = [
  {
    icon: <Heart className={`${iconSizeClasses[0]} stroke-black stroke-[1.5] animate-pulse hover:fill-black fill-transparent transition-colors duration-300 relative z-10`} />,
    labelKey: 'howItWorks.step.vote'
  },
  {
    icon: (
      <div className={`relative flex items-center justify-center ${iconSizeClasses[1]} z-10`}>
        <Smartphone className="absolute inset-0 w-full h-full stroke-black stroke-[1.5]" />
        <AtSign className="absolute inset-0 m-auto w-[55%] h-[55%] md:w-[60%] md:h-[60%] stroke-black stroke-[2] animate-[spin_4s_linear_infinite]" />
      </div>
    ),
    labelKey: 'howItWorks.step.share'
  },
  {
    icon: (
      <Gift className={`${iconSizeClasses[2]} stroke-black stroke-[1.5] hover:-translate-y-2 transition-transform duration-300 relative z-10`} />
    ),
    labelKey: 'howItWorks.step.collect'
  },
]

export function HowItWorksSection() {
  const { t } = useLocale()
  return (
    <SectionFrame theme="how-it-works" className="text-white flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-blk)" className="max-w-7xl mx-auto py-(--section-pad)">
        <h2 className="text-(length:--fs-headline-tight) font-[900] text-center mb-(--rythm-blk) tracking-tighter lowercase leading-(--lh-headline) flex flex-wrap xl:flex-nowrap justify-center items-center gap-x-2 md:gap-x-4 w-full [text-wrap:balance] flex-shrink-0">
          <span className="whitespace-nowrap">{t('howItWorks.title.simple')}</span>
          <span className="whitespace-nowrap flex items-center">
            {t('howItWorks.title.win')}

            <span className="relative grid grid-cols-[1.1rem_0.9rem] items-end justify-items-center ml-2 md:ml-4 -mt-2">
              <Image
                src="/star-decoration.svg"
                alt=""
                width={83}
                height={82}
                className="w-10 h-10 md:w-14 md:h-14 lg:w-[60px] lg:h-[60px] object-contain relative z-10 rotate-12 scale-95 max-w-none"
              />
              <Image
                src="/star-decoration-alt.svg"
                alt=""
                width={81}
                height={79}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-[45px] lg:h-[45px] object-contain relative z-0 -rotate-[15deg] scale-110 -ml-3 md:-ml-4 max-w-none"
              />
            </span>
          </span>
        </h2>

        {/* Auto-fit grid: 1 col mobile → up to 3 cols desktop */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(clamp(9rem,26svh,12rem),1fr))] items-center justify-items-center gap-(--rythm-blk) w-full max-w-6xl flex-shrink min-h-0">
          {steps.map((step, index) => (
            <div key={index} className="relative flex flex-col items-center w-full max-w-xs lg:max-w-none">

              <div className={`relative ${cardSizeClasses} bg-white rounded-3xl md:rounded-4xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 shrink`}>
                {step.icon}
              </div>

              <p className="text-[clamp(0.625rem,2vw,1.125rem)] font-[700] text-center max-w-[min(30ch,100%)] leading-tight mt-[clamp(0.375rem,1.5vw,1rem)] flex-shrink-0">
                {t(step.labelKey)}
              </p>
            </div>
          ))}
        </div>
      </SafeCenterSection>
    </SectionFrame>
  )
}
