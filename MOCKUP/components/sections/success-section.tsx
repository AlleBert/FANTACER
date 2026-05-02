'use client'

import Image from 'next/image'

export function SuccessSection() {
  return (
    <section className="relative w-full h-[100dvh] bg-white flex items-center justify-center overflow-hidden">
      {/* Background Frame */}
      <Image
        src="/section-frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        {/* Title */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-8 text-[#8000ff] uppercase tracking-tighter">
          sei forte!
        </h2>
        
        {/* Share section */}
        <div className="space-y-6 mb-8">
          <p className="text-base md:text-lg lg:text-xl text-gray-700 font-medium">
            condividi sui social taggando <strong>@fantacer</strong>
          </p>
          
          {/* Social icons */}
          <Image
            src="/social-share-icons.png"
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
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
          <div className="relative w-32 h-32 md:w-48 md:h-48 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0_#000] rotate-[-2deg]">
            <Image
              src="/contact-logo-main.png"
              alt="Logo X"
              fill
              className="object-contain p-2"
            />
          </div>
          <div className="relative w-32 h-32 md:w-48 md:h-48 border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0_#000] rotate-[2deg]">
            <Image
              src="/contact-logo-secondary.png"
              alt="Logo Y"
              fill
              className="object-contain p-2"
            />
          </div>
        </div>
      </div>
      
      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        <Image
          src="/decoration-flower.png"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
      </div>
    </section>
  )
}