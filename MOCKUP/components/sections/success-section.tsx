'use client'

import Image from 'next/image'

export function SuccessSection() {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      {/* Background Frame */}
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        {/* Title */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-[#8000ff]">
          sei forte!
        </h2>
        
        {/* Share section */}
        <div className="space-y-6 mb-8">
          <p className="text-base md:text-lg lg:text-xl text-gray-700 font-medium">
            condividi sui social taggando <strong>@fantacer</strong>
          </p>
          
          {/* Social icons */}
          <Image
            src="/95cac10af42d51fea008a82099e325f2-png@2x.png"
            alt="Social share icons"
            width={48}
            height={48}
            className="w-12 h-12 mx-auto object-contain"
          />
          
          <p className="text-base md:text-lg lg:text-xl text-gray-700 font-medium">
            e ritira il tuo premio qui
          </p>
        </div>
        
        {/* Logos */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#8000ff]">
            logo X
          </h3>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#8000ff]">
            logo Y
          </h3>
        </div>
      </div>
      
      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        <Image
          src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
      </div>
    </section>
  )
}