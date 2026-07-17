import Image from 'next/image'
import type { ReactNode } from 'react'
import { Heart, MessageCircleMore, Smartphone, AtSign, Gift } from 'lucide-react'

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
    icon: <MessageCircleMore className="w-14 h-14 md:w-[72px] md:h-[72px] lg:w-20 lg:h-20 stroke-black stroke-[1.5] relative z-10" />, 
    label: 'rispondi a 3 domande sul suo stand' 
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

export function HowItWorksSection() {
  return (
    <section className="snap-start relative w-full min-h-[100dvh] py-10 md:py-20 bg-[linear-gradient(to_bottom,#FF8A26_10%,#FF2FB2_100%)] text-white flex items-center justify-center overflow-hidden">
      {/* Content */}
      <div className="relative z-10 max-w-[1600px] w-full mx-auto px-4 md:px-6 lg:px-12 py-12 lg:py-16 flex flex-col items-center">
        {/* Responsive, lowercase heading with inline decorations */}
        <h2 className="text-[clamp(1.75rem,6.2vw,91px)] font-[900] text-center mb-12 lg:mb-20 tracking-tighter lowercase leading-[0.95] flex flex-wrap xl:flex-nowrap justify-center items-center gap-x-2 md:gap-x-4 w-full">
          <span className="whitespace-nowrap">è semplice...</span>
          <span className="whitespace-nowrap flex items-center">
            e si vince sempre!
            
            {/* Overlapping Stars (Yellow) */}
            <span className="flex items-center -space-x-3 md:-space-x-4 ml-2 md:ml-4 -mt-2">
              <Image
                src="/star-decoration.svg"
                alt="Yellow star"
                width={83}
                height={82}
                className="w-10 h-10 md:w-14 md:h-14 lg:w-[60px] lg:h-[60px] object-contain relative z-10 rotate-12 scale-95"
              />
              <Image
                src="/star-decoration-alt.svg"
                alt="Secondary yellow star with border"
                width={81}
                height={79}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-[45px] lg:h-[45px] object-contain relative z-0 -rotate-[15deg] scale-110"
              />
            </span>
          </span>
        </h2>
        
        {/* Steps grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              {/* React Component Card */}
              <div className="relative w-32 h-32 md:w-36 md:h-36 lg:w-44 lg:h-44 mb-4 bg-white rounded-[2.2rem] md:rounded-[2.7rem] lg:rounded-[3.2rem] border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2 cursor-pointer">
                {step.icon}
              </div>
              
              {/* Label */}
              <p className="text-[min(4vw,30px)] font-[600] text-center max-w-[14rem] leading-tight mt-6">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}