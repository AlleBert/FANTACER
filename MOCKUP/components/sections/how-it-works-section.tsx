'use client'

import Image from 'next/image'

interface Step {
  icon: string
  label: string
}

const steps: Step[] = [
  { icon: '/SVG@2x.png', label: 'vota la tua azienda preferita' },
  { icon: '/SVG3@2x.png', label: 'rispondi a 3 domande sul suo stand' },
  { icon: '/SVG2@2x.png', label: 'condividi il tuo voto taggando @fantacer' },
  { icon: '/SVG4@2x.png', label: 'ritira il tuo premio' },
]

export function HowItWorksSection() {
  return (
    <section className="relative w-full bg-mockup-orange text-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 tracking-tight">
          è semplice... e si vince sempre!
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="relative w-32 h-32 md:w-40 md:h-40 mb-4">
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
                  className="absolute inset-2 w-24 h-24 md:w-32 md:h-32 object-contain"
                />
              </div>
              <p className="text-center text-sm md:text-base font-medium max-w-[10rem]">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={83}
        height={82}
        className="absolute top-20 right-8 w-16 h-16 object-contain"
      />
    </section>
  )
}