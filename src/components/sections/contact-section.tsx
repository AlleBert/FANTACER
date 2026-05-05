'use client'

import { Button } from '@/components/ui/button'

export function ContactSection() {
  return (
    <section id="contact-section" className="relative w-full overflow-hidden bg-[linear-gradient(to_bottom,#4B00AB_0%,#a088db_40%,#efdeff_100%)] min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col-reverse items-center justify-center gap-4 px-3 sm:px-6 md:px-8 lg:flex-row lg:gap-16 lg:px-16 py-3 sm:py-6">
        
        {/* Left: Contact Form */}
        <div className="w-full max-w-[280px] sm:max-w-sm md:max-w-md rounded-2xl sm:rounded-3xl border-2 sm:border-[3px] border-[#231f20] bg-white p-3 sm:p-4 md:p-6 shadow-[3px_3px_0_#000] sm:shadow-[4px_4px_0_#000] lg:w-5/12">
          <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black text-black uppercase tracking-tighter mb-3 sm:mb-4 lg:mb-6 text-center lg:text-left leading-none sm:leading-tight">
            Inviaci un messaggio
          </h3>
          <form className="flex flex-col gap-2 sm:gap-3" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="text" 
              placeholder="NOME" 
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-2 border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-0.5 transition-all"
            />
            <input 
              type="email" 
              placeholder="EMAIL" 
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-2 border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-0.5 transition-all"
            />
            <textarea 
              placeholder="MESSAGGIO..." 
              rows={2}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-2xl border-2 border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-0.5 transition-all resize-none"
            />
            <Button 
              type="submit"
              className="bg-[#8000ff] hover:bg-[#6b00d6] text-xs sm:text-sm md:text-base font-black px-4 sm:px-6 md:px-8 py-2 sm:py-3 mt-1 rounded-full border-2 sm:border-[3px] border-[#231f20] shadow-[2px_2px_0_#000] hover:shadow-[3px_3px_0_#000] hover:-translate-y-0.5 transition-all"
            >
              INVIA
            </Button>
          </form>
        </div>
        
        {/* Right: Contact info */}
        <div className="flex w-full max-w-[280px] sm:max-w-md flex-col items-center gap-3 sm:gap-4 text-center lg:w-6/12 lg:items-start lg:text-left">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-[0.85] font-black text-white tracking-tighter uppercase drop-shadow-[2px_2px_0_#231f20]">
            PARLA CON NOI
          </h2>
          
          <div className="flex w-full flex-col items-center gap-2 sm:gap-3 lg:items-start">
            <div className="bg-white px-3 sm:px-4 py-1.5 sm:py-2 md:py-3 rounded-full border-2 border-[#231f20] shadow-[2px_2px_0_#000] transform -rotate-1 sm:-rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-xs sm:text-sm md:text-base font-black text-black lowercase">
                fantacer@fantacer.com
              </p>
            </div>
            
            <div className="bg-[#fccb27] px-3 sm:px-4 py-1.5 sm:py-2 md:py-3 rounded-full border-2 border-[#231f20] shadow-[2px_2px_0_#000] transform rotate-1 sm:rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-xs sm:text-sm md:text-base font-black text-black tracking-wider">
                00 000 000
              </p>
            </div>
            
            <div className="bg-white px-3 sm:px-4 py-1.5 sm:py-2 md:py-3 rounded-full border-2 border-[#231f20] shadow-[2px_2px_0_#000] transform -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-0.5">
              <p className="text-xs sm:text-sm md:text-base font-black text-[#8000ff] lowercase">
                www.fantacer.com
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </section>
  )
}