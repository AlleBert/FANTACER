'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Heart, Smartphone, AtSign, Gift } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'

interface Step {
  icon: ReactNode
  labelKey: 'howItWorks.step.vote' | 'howItWorks.step.share' | 'howItWorks.step.collect'
}

const steps: Step[] = [
  {
    icon: <Heart className="w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 stroke-black stroke-[1.5] animate-pulse hover:fill-black fill-transparent transition-colors duration-300 relative z-10" />,
    labelKey: 'howItWorks.step.vote'
  },
  {
    icon: (
      <div className="relative flex items-center justify-center w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 z-10">
        <Smartphone className="absolute inset-0 w-full h-full stroke-black stroke-[1.5]" />
        <AtSign className="absolute inset-0 m-auto w-6 h-6 md:w-8 md:h-8 stroke-black stroke-[2] animate-[spin_4s_linear_infinite]" />
      </div>
    ),
    labelKey: 'howItWorks.step.share'
  },
  {
    icon: (
      <Gift className="w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 stroke-black stroke-[1.5] hover:-translate-y-2 transition-transform duration-300 relative z-10" />
    ),
    labelKey: 'howItWorks.step.collect'
  },
]

// Uniform card sizes — all 3 steps same size
// clamp keeps cards square and proportional on small viewports
const cardSizeClasses = [
  'w-[clamp(96px,14dvh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
  'w-[clamp(96px,14dvh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
  'w-[clamp(96px,14dvh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
]

export function HowItWorksSection() {
  const { t } = useLocale()
  return (
    <section className="snap-start relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#FF8A26_10%,#FF2FB2_100%)] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="safe-shell h-full flex flex-col">
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center justify-center flex-1 min-h-0 py-8 lg:py-12">

        <h2 className="text-[clamp(1.75rem,6.2vw,4.5rem)] font-[900] text-center mb-4 md:mb-8 lg:mb-12 tracking-tighter lowercase leading-[0.95] flex flex-wrap xl:flex-nowrap justify-center items-center gap-x-2 md:gap-x-4 w-full [text-wrap:balance] flex-shrink-0">
          <span className="whitespace-nowrap">{t('howItWorks.title.simple')}</span>
          <span className="whitespace-nowrap flex items-center">
            {t('howItWorks.title.win')}

            <span className="flex items-center -space-x-3 md:-space-x-4 ml-2 md:ml-4 -mt-2">
              <Image
                src="/star-decoration.svg"
                alt=""
                width={83}
                height={82}
                className="w-10 h-10 md:w-14 md:h-14 lg:w-[60px] lg:h-[60px] object-contain relative z-10 rotate-12 scale-95"
              />
              <Image
                src="/star-decoration-alt.svg"
                alt=""
                width={81}
                height={79}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-[45px] lg:h-[45px] object-contain relative z-0 -rotate-[15deg] scale-110"
              />
            </span>
          </span>
        </h2>

        {/* Mobile: vertical stack | Desktop: asymmetric 3-col grid */}
        <div className="flex flex-col items-center gap-4 md:gap-8 lg:grid lg:grid-cols-[1fr_1fr_1fr] lg:gap-6 lg:items-center lg:w-full lg:max-w-6xl flex-shrink min-h-0">
          {steps.map((step, index) => (
            <div key={index} className="relative flex flex-col items-center w-full max-w-xs lg:max-w-none shrink">

              <div className={`relative ${cardSizeClasses[index]} bg-white rounded-3xl md:rounded-4xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 shrink`}>
                {step.icon}
              </div>

              <p className="text-[clamp(0.875rem,2.5vw,1.125rem)] font-[700] text-center max-w-[14rem] leading-tight mt-4 flex-shrink-0">
                {t(step.labelKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}