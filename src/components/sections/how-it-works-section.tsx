'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Heart, Smartphone, AtSign, Gift } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'

interface Step {
  icon: ReactNode
  labelKey: 'howItWorks.step.vote' | 'howItWorks.step.share' | 'howItWorks.step.collect'
}

// Uniform card sizes — all 3 steps same size
// clamp keeps cards square and proportional on small viewports (svh-based → comprimono con l'altezza)
const cardSizeClasses = [
  'w-[clamp(56px,17svh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
  'w-[clamp(56px,17svh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
  'w-[clamp(56px,17svh,128px)] aspect-square md:w-40 md:h-40 lg:w-52 lg:h-52',
]

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
    <section className="snap-screen relative w-full bg-[linear-gradient(to_bottom,var(--color-orange)_10%,#FF2FB2_100%)] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="safe-shell h-full flex flex-col">
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center justify-center flex-1 min-h-0 py-[clamp(0.75rem,3svh,3rem)] lg:py-12">

        <h2 className="text-[clamp(1.25rem,min(4.5vw,7vw),4.5rem)] font-[900] text-center mb-[clamp(0.5rem,1.5vw,3rem)] tracking-tighter lowercase leading-[1.08] flex flex-wrap xl:flex-nowrap justify-center items-center gap-x-2 md:gap-x-4 w-full [text-wrap:balance] flex-shrink-0">
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
        <div className="flex flex-col items-center gap-[clamp(0.75rem,2.5svh,2rem)] sm:grid sm:grid-cols-3 sm:gap-6 sm:items-center sm:w-full sm:max-w-6xl flex-shrink min-h-0">
          {steps.map((step, index) => (
            <div key={index} className="relative flex flex-col items-center w-full max-w-xs lg:max-w-none shrink">

              <div className={`relative ${cardSizeClasses[index]} bg-white rounded-3xl md:rounded-4xl border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 shrink`}>
                {step.icon}
              </div>

              <p className="text-[clamp(0.625rem,2vw,1.125rem)] font-[700] text-center max-w-[min(30ch,100%)] leading-tight mt-[clamp(0.375rem,1.5vw,1rem)] flex-shrink-0">
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