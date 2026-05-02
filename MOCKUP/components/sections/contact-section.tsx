'use client'

import Image from 'next/image'

export function ContactSection() {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">
        <div className="relative w-64 h-64 lg:w-80 lg:h-80 flex-shrink-0">
          <Image
            src="/e87e80273f472378a7e56db0ad11236b-png@2x.png"
            alt="Company logo"
            width={309}
            height={310}
            className="w-full h-full object-contain"
          />
          <Image
            src="/2943c6147df3dccbfdf556fde3b7036e-png@2x.png"
            alt="Secondary logo"
            width={163}
            height={118}
            className="absolute top-0 left-0 w-32 h-24 object-contain"
          />
        </div>
        
        <div className="text-center lg:text-left">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 tracking-tight">
            Parla con noi
          </h2>
          
          <div className="space-y-4">
            <p className="text-xl md:text-2xl lg:text-3xl text-gray-700">
              fantacer@fantacer.com
            </p>
            
            <div className="space-y-2">
              <p className="text-lg md:text-xl lg:text-2xl text-gray-700">
                00 000 000
              </p>
              <p className="text-lg md:text-xl lg:text-2xl text-gray-700">
                www.fantacer.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}