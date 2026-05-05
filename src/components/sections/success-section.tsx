'use client'

import Image from 'next/image'

function IphoneStoryMockup() {
  return (
    <div 
      className="relative w-[180px] xs:w-[200px] sm:w-[250px] md:w-[280px] lg:w-[320px] mx-auto lg:mx-0 shrink-0 transform md:rotate-1"
      style={{ aspectRatio: '252 / 479' }}
    >
      {/* Background/Shadow layer - matches phone shape without shadowing SVG text */}
      <div 
        className="absolute inset-[3px] bg-black/25 rounded-[38px] translate-x-3 translate-y-3 blur-[2px] z-[-1]" 
        aria-hidden="true"
      />
      
      {/* Base Phone and Background */}
      <img 
        src="/stories.svg?v=3"
        alt="Phone Frame"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
      />

      {/* Instagram Story Content Overlay */}
      {/* Positioned inside the screen bezel safely */}
      <div className="absolute inset-x-[6%] top-[8%] bottom-[5%] z-10 flex flex-col justify-between py-4 px-2">
        
        {/* Story Text Content Area */}
        <div className="flex flex-col items-center justify-center space-y-2.5 text-center mt-2 md:mt-4">
          <div className="bg-black/85 px-3.5 py-1.5 rounded-xl backdrop-blur-sm inline-block">
            <h3 className="text-sm md:text-base font-bold text-white leading-tight">
              Hai votato ceramica <br/> <span className="text-[#fccb27]">xyz</span>
            </h3>
          </div>
          
          <div className="bg-white px-2.5 py-1 rounded-lg inline-block transform -rotate-1">
            <p className="text-[10px] md:text-xs font-bold text-black uppercase tracking-wide">
              miglior stand 2026
            </p>
          </div>
        </div>

        {/* Footer Content */}
        <div className="flex flex-col items-center space-y-6 pb-2">
          
          <div className="bg-gradient-to-r from-[#8000ff] to-[#ff803b] p-[1.5px] rounded-2xl w-[85%] transform rotate-1">
             <div className="bg-white w-full rounded-[14px] py-1.5 px-0.5 text-center">
               <p className="text-[10px] md:text-xs font-bold text-black leading-tight">
                 Gioca anche tu,<br/>si vince sempre!
               </p>
             </div>
          </div>
          
          <div className="flex justify-center gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center">
              <span className="text-sm font-black text-[#8000ff]">X</span>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center">
              <span className="text-sm font-black text-[#ff803b]">Y</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export function SuccessSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[linear-gradient(to_bottom,#ffffff_0%,#ffffff_20%,#4B00AB_100%)] min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center gap-10 px-6 lg:flex-row lg:justify-between lg:gap-20 lg:px-16 py-4 md:py-8">
        
          {/* Left Column: Text & Logos */}
          <div className="relative flex w-full flex-col items-center text-center lg:w-[55%] lg:items-start lg:text-left">
          {/* Title */}
          <h2 className="text-[clamp(2.5rem,10vw,120px)] leading-[0.85] font-black mb-6 lg:mb-10 text-[#8000ff] uppercase tracking-tighter">
            sei <br className="hidden lg:block"/>forte!
          </h2>
        
          <div className="space-y-5 mb-6 lg:mb-12 w-full max-w-lg">
            <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-[900] text-[#231f20] leading-tight uppercase tracking-tight">
              condividi sui social <br/> taggando <span className="bg-[#fccb27] px-2 border-2 border-black rounded-lg inline-block rotate-1 shadow-[2px_2px_0_#000]">@fantacer</span>
            </p>
            <div className="flex justify-center lg:justify-start pt-2 gap-6">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram w-11 h-11 md:w-14 md:h-14 lg:w-16 lg:h-16 text-black transition-transform hover:scale-110"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-facebook w-11 h-11 md:w-14 md:h-14 lg:w-16 lg:h-16 text-black transition-transform hover:scale-110"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-[900] text-white lg:text-[#231f20] leading-[1.2] uppercase tracking-tight mt-8 lg:mt-12">
              e ritira il tuo premio qui
            </p>
          </div>
        
          {/* Main Logos */}
          <div className="flex flex-row items-center justify-center gap-6 md:gap-10 lg:justify-start">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0_#000] rotate-[-3deg] transition-all hover:-translate-y-2 hover:rotate-[-6deg] sm:h-28 sm:w-28 md:h-32 md:w-32 md:shadow-[6px_6px_0_#000] lg:h-36 lg:w-36">
              <span className="text-3xl md:text-4xl font-black text-[#8000ff]">X</span>
            </div>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0_#000] rotate-[3deg] transition-all hover:-translate-y-2 hover:rotate-[6deg] sm:h-28 sm:w-28 md:h-32 md:w-32 md:shadow-[6px_6px_0_#000] lg:h-36 lg:w-36">
              <span className="text-3xl md:text-4xl font-black text-[#ff803b]">Y</span>
            </div>
          </div>
        </div>

          {/* Right Column: Mobile Story Mockup */}
          <div className="relative mt-4 flex w-full justify-center lg:mt-0 lg:w-[45%] lg:justify-end">
            {/* Decorative Floating Stars */}
            <div className="absolute top-[2%] right-[20%] -z-10 lg:right-[10%]">
              <Image
                src="/star-decoration-alt.svg"
                alt=""
                width={100}
                height={100}
                className="w-16 h-16 lg:w-20 lg:h-20 object-contain rotate-12 opacity-90 drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)] animate-pulse"
              />
            </div>
            <div className="absolute bottom-[5%] left-[10%] -z-10 lg:left-[5%]">
              <Image
                src="/star-decoration.svg"
                alt=""
                width={90}
                height={90}
                className="w-14 h-14 lg:w-18 lg:h-18 object-contain -rotate-12 opacity-80 drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)]"
              />
            </div>
            
            <IphoneStoryMockup />
          </div>
      </div>
    </section>
  )
}
