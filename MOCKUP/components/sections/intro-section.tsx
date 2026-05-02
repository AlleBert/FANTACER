'use client'

import Image from 'next/image'

export function IntroSection() {
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
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 lg:px-12 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Logo and GIOCA text */}
        <div className="relative flex flex-col items-center lg:items-start">
          <div className="relative w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64">
            <Image
              src="/Mask-Group3@2x.png"
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/184f76b6b5b8e7190c9d149c69f1b9af-png@2x.png"
                alt=""
                width={171}
                height={171}
                className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 object-contain"
              />
            </div>
          </div>
          
          {/* GIOCA text overlay */}
          <div className="flex items-center mt-4">
            <h2 className="text-orange text-xl md:text-2xl font-bold tracking-tight" style={{ color: '#ff8c23' }}>
              GIOCA
            </h2>
          </div>
        </div>
        
        {/* Right: Headlines */}
        <div className="text-center lg:text-left">
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight leading-tight lg:leading-[3.75rem]">
            il primo gioco
            <br />
            semiserio del
            <br />
            distretto ceramico
          </h1>
          
          <p className="mt-6 text-lg md:text-xl lg:text-2xl text-gray-700 font-normal leading-relaxed">
            usa il cellulare per qualcosa di
            <br />
            davvero importante!
          </p>
        </div>
      </div>
    </section>
  )
}