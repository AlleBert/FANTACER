'use client'

import Image from 'next/image'

export function SuccessSection() {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-mockup-purple">
          sei forte!
        </h2>
        
        <div className="space-y-6 mb-8">
          <p className="text-lg md:text-xl text-gray-700 font-medium">
            condividi sui social taggando @fantacer
          </p>
          
          <Image
            src="/95cac10af42d51fea008a82099e325f2-png@2x.png"
            alt="Social share icons"
            width={48}
            height={48}
            className="w-16 h-16 mx-auto object-contain"
          />
          
          <p className="text-lg md:text-xl text-gray-700 font-medium">
            e ritira il tuo premio qui
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row justify-center items-center gap-8">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-mockup-purple">
            logo X
          </h3>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-mockup-purple">
            logo Y
          </h3>
        </div>
      </div>
      
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={134}
        height={132}
        className="absolute left-8 top-1/2 w-24 h-24 -translate-y-1/2 object-contain hidden md:block"
      />
    </section>
  )
}