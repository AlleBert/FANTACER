'use client'

import Image from 'next/image'

function IphoneStoryMockup() {
  return (
    <div 
      className="relative w-[280px] md:w-[320px] mx-auto lg:mx-0 shrink-0 transform md:rotate-2"
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
        <div className="flex flex-col items-center justify-center space-y-4 text-center mt-6">
          <div className="bg-black/85 px-5 py-3 rounded-xl backdrop-blur-sm inline-block">
            <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
              Hai votato ceramica <br/> <span className="text-[#fccb27]">xyz</span>
            </h3>
          </div>
          
          <div className="bg-white px-4 py-1.5 rounded-lg inline-block transform -rotate-2">
            <p className="text-sm md:text-base font-bold text-black uppercase tracking-wide">
              miglior stand 2026
            </p>
          </div>
        </div>

        {/* Footer Content */}
        <div className="flex flex-col items-center space-y-6 pb-2">
          
          <div className="bg-gradient-to-r from-[#8000ff] to-[#ff803b] p-[3px] rounded-2xl w-[90%] transform rotate-1">
             <div className="bg-white w-full rounded-[14px] py-3 px-2 text-center">
               <p className="text-sm md:text-base font-bold text-black">
                 Gioca anche tu,<br/>si vince sempre!
               </p>
             </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center">
              <span className="text-lg font-black text-[#8000ff]">X</span>
            </div>
            <div className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center">
              <span className="text-lg font-black text-[#ff803b]">Y</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export function SuccessSection() {
  return (
    <section className="relative w-full min-h-[100dvh] bg-[linear-gradient(to_bottom,#ffffff_0%,#ffffff_20%,#4B00AB_100%)] flex flex-col lg:flex-row items-center justify-center overflow-hidden py-16 gap-12 lg:gap-8 lg:px-8">

      {/* Left Column: Text & Logos */}
      <div className="relative z-10 w-full max-w-2xl lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left px-4">
        {/* Title */}
        <h2 className="text-[clamp(3.5rem,8vw,120px)] leading-[0.85] font-black mb-8 lg:mb-12 text-[#8000ff] uppercase tracking-tighter">
          sei <br className="hidden lg:block"/>forte!
        </h2>
        
        <div className="space-y-4 mb-10 w-full max-w-md">
          <p className="text-[clamp(1.2rem,2.5vw,30px)] font-[900] text-[#231f20] leading-tight uppercase tracking-tight">
            condividi sui social <br/> taggando <span className="bg-[#fccb27] px-2 border-2 border-black rounded-lg inline-block rotate-1 shadow-[2px_2px_0_#000]">@fantacer</span>
          </p>
          <div className="flex justify-center lg:justify-start pt-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram mr-4 w-12 h-12 text-black"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-facebook w-12 h-12 text-black"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </div>
          <p className="text-[clamp(1.2rem,2.5vw,30px)] font-[900] text-white lg:text-[#231f20] leading-[1.2] uppercase tracking-tight mt-6">
            e ritira il tuo premio qui
          </p>
        </div>
        
        {/* Main Logos */}
        <div className="flex flex-col sm:flex-row justify-center lg:justify-start items-center gap-6 md:gap-10">
          <div className="relative w-28 h-28 md:w-36 md:h-36 border-[3px] border-black rounded-2xl bg-white shadow-[6px_6px_0_#000] rotate-[-3deg] flex items-center justify-center hover:-translate-y-2 hover:rotate-[-6deg] transition-all">
            <span className="text-4xl font-black text-[#8000ff]">X</span>
          </div>
          <div className="relative w-28 h-28 md:w-36 md:h-36 border-[3px] border-black rounded-2xl bg-white shadow-[6px_6px_0_#000] rotate-[3deg] flex items-center justify-center hover:-translate-y-2 hover:rotate-[6deg] transition-all">
            <span className="text-4xl font-black text-[#ff803b]">Y</span>
          </div>
        </div>
      </div>

      {/* Right Column: Mobile Story Mockup */}
      <div className="relative z-10 w-full lg:w-1/2 flex justify-center lg:justify-end px-4 mt-8 lg:mt-0">
        {/* Decorative Floating Stars */}
        <div className="absolute top-[5%] lg:right-[15%] right-[25%] -z-10">
          <Image
            src="/star-decoration-alt.svg"
            alt=""
            width={134}
            height={132}
            className="w-24 h-24 lg:w-32 lg:h-32 object-contain rotate-12 opacity-90 drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)] animate-pulse"
          />
        </div>
        <div className="absolute bottom-[10%] lg:left-[10%] left-[5%] -z-10">
          <Image
            src="/star-decoration.svg"
            alt=""
            width={130}
            height={127}
            className="w-20 h-20 lg:w-28 lg:h-28 object-contain -rotate-12 opacity-80 drop-shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
          />
        </div>
        
        <IphoneStoryMockup />
      </div>

    </section>
  )
}