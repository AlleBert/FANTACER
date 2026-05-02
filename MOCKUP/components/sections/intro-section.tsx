'use client'

import Image from 'next/image'

export function IntroSection() {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4 md:px-8 lg:px-12">
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="relative inline-block mb-8">
          <Image
            src="/Mask-Group3@2x.png"
            alt=""
            width={560}
            height={561}
            className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 mx-auto object-cover"
          />
          <Image
            src="/184f76b6b5b8e7190c9d149c69f1b9af-png@2x.png"
            alt=""
            width={171}
            height={171}
            className="absolute inset-0 m-auto w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 object-cover"
          />
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-mockup-orange tracking-tight leading-tight">
          il primo gioco
          <br />
          semiserio del
          <br />
          distretto ceramico
        </h1>
        
        <p className="mt-6 text-xl md:text-2xl lg:text-3xl text-gray-700 max-w-2xl mx-auto">
          usa il cellulare per qualcosa di
          <br />
          davvero importante!
        </p>
      </div>
    </section>
  )
}