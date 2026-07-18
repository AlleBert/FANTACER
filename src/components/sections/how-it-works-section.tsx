import Image from 'next/image'
import type { ReactNode } from 'react'
import { Heart, Smartphone, AtSign, Gift } from 'lucide-react'

interface Step {
  icon: ReactNode
  label: string
}

const steps: Step[] = [
  {
    icon: <Heart className="w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 stroke-black stroke-[1.5] animate-pulse hover:fill-black fill-transparent transition-colors duration-300 relative z-10" />,
    label: 'vota la tua azienda preferita'
  },
  {
    icon: (
      <div className="relative flex items-center justify-center w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 z-10">
        <Smartphone className="absolute inset-0 w-full h-full stroke-black stroke-[1.5]" />
        <AtSign className="absolute inset-0 m-auto w-6 h-6 md:w-8 md:h-8 stroke-black stroke-[2] animate-[spin_4s_linear_infinite]" />
      </div>
    ),
    label: 'condividi il tuo voto taggando @fantacer'
  },
  {
    icon: (
      <Gift className="w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 stroke-black stroke-[1.5] hover:-translate-y-2 transition-transform duration-300 relative z-10" />
    ),
    label: 'ritira il tuo premio'
  },
]

// Asymmetric card sizes — steps 1 & 3 larger, step 2 smaller
// dvh caps prevent overflow on short viewports
const cardSizeClasses = [
  'w-32 h-32 max-h-[18dvh] md:w-40 md:h-40 md:max-h-[22dvh] lg:w-52 lg:h-52 lg:max-h-[28dvh]',
  'w-32 h-32 max-h-[18dvh] md:w-36 md:h-36 md:max-h-[20dvh] lg:w-40 lg:h-40 lg:max-h-[24dvh]',
  'w-32 h-32 max-h-[18dvh] md:w-40 md:h-40 md:max-h-[22dvh] lg:w-52 lg:h-52 lg:max-h-[28dvh]',
]

export function HowItWorksSection() {
  return (
    <section className="snap-start relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#FF8A26_10%,#FF2FB2_100%)] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-12 py-8 lg:py-12 flex flex-col items-center justify-center flex-1 min-h-0">

        <h2 className="text-[clamp(1.75rem,6.2vw,91px)] font-[900] text-center mb-8 lg:mb-12 tracking-tighter lowercase leading-[0.95] flex flex-wrap xl:flex-nowrap justify-center items-center gap-x-2 md:gap-x-4 w-full [text-wrap:balance] flex-shrink-0">
          <span className="whitespace-nowrap">è semplice...</span>
          <span className="whitespace-nowrap flex items-center">
            e si vince sempre!

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
        <div className="flex flex-col items-center gap-8 lg:grid lg:grid-cols-[1.2fr_0.8fr_1.2fr] lg:gap-6 lg:items-center lg:w-full lg:max-w-6xl flex-shrink min-h-0">
          {steps.map((step, index) => (
            <div key={index} className="relative flex flex-col items-center w-full max-w-xs lg:max-w-none shrink">

              <span className="text-[clamp(0.6rem,1.5vw,0.85rem)] font-[700] text-white/40 mb-1 md:mb-2 tracking-[0.15em] uppercase flex-shrink-0">
                passo {(index + 1).toString().padStart(2, '0')}
              </span>

              <div className={`relative ${cardSizeClasses[index]} bg-white rounded-[2.2rem] md:rounded-[2.7rem] lg:rounded-[3.2rem] border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 shrink`}>
                {step.icon}
              </div>

              <p className="text-[min(3.5vw,24px)] font-[600] text-center max-w-[14rem] leading-tight mt-3 flex-shrink-0">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}