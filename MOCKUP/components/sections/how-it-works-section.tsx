'use client'

import Image from 'next/image'

interface Step {
  icon: string
  label: string
}

const steps: Step[] = [
  { icon: '/SVG@2x.png', label: 'vota la tua azienda preferita' },
  { icon: '/SVG3@2x.png', label: 'rispondi a 3 domande sul suo stand' },
  { icon: '/SVG1@2x.png', label: 'condividi il tuo voto taggando @fantacer' },
  { icon: '/SVG4@2x.png', label: 'ritira il tuo premio' },
]

export function HowItWorksSection() {
  return (
    <section className="relative w-full bg-[#ff8a26] text-white py-16 md:py-24 lg:py-32">
      {/* Background white area */}
      <div className="absolute inset-0 bg-white" />
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 lg:px-12 py-12 lg:py-16">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 lg:mb-16 tracking-tight">
          è semplice... e si vince sempre!
        </h2>
        
        {/* Steps grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              {/* Icon circle */}
              <div className="relative w-28 h-28 md:w-32 md:h-32 lg:w-40 lg:h-40 mb-4">
                <Image
                  src="/Mask-Group.svg"
                  alt=""
                  fill
                  className="object-contain"
                />
                <Image
                  src={step.icon}
                  alt={step.label}
                  width={146}
                  height={146}
                  className="absolute inset-2 md:inset-4 w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain"
                />
              </div>
              
              {/* Label */}
              <p className="text-sm md:text-base lg:text-lg font-medium text-center max-w-[10rem] leading-tight">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Decorative images - top right */}
      <div className="absolute top-8 right-8 flex gap-2">
        <Image
          src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
          alt=""
          width={83}
          height={82}
          className="w-12 h-12 md:w-16 md:h-16 object-contain"
        />
        <Image
          src="/840edc06-e826-44c6-bba4-2b5d4e2b5b7f1@2x.png"
          alt=""
          width={81}
          height={79}
          className="w-12 h-12 md:w-16 md:h-16 object-contain"
        />
      </div>
    </section>
  )
}