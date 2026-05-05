'use client'

import { Button } from '@/components/ui/button'

export function ContactSection() {
  return (
    <section id="contact-section" className="relative w-full overflow-hidden bg-[linear-gradient(to_bottom,#4B00AB_0%,#a088db_40%,#efdeff_100%)] min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col-reverse items-center justify-center gap-6 px-4 md:px-8 lg:flex-row lg:gap-16 py-2 md:py-4">

        
        {/* Left: Contact Form (Work in Progress) */}
        <div className="w-full max-w-md rounded-2xl border-[3px] border-[#231f20] bg-white p-4 shadow-[4px_4px_0_#000] md:p-6 md:shadow-[6px_6px_0_#000] lg:w-5/12 lg:max-w-none">
          <h3 className="text-lg sm:text-xl md:text-2xl font-[900] text-black uppercase tracking-tighter mb-4 text-center lg:text-left leading-tight">
            Inviaci un messaggio
          </h3>
          <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="text" 
              placeholder="NOME" 
              className="w-full px-4 py-2 text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-[2px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-1 transition-all"
            />
            <input 
              type="email" 
              placeholder="EMAIL" 
              className="w-full px-4 py-2 text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-[2px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-1 transition-all"
            />
            <textarea 
              placeholder="MESSAGGIO..." 
              rows={2}
              className="w-full px-4 py-2 text-sm md:text-base bg-[#f5f5f5] text-black font-bold uppercase rounded-2xl border-[2px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#000] focus:-translate-y-1 transition-all resize-none"
            />
            <Button 
              type="submit"
              className="bg-[#8000ff] hover:bg-[#6b00d6] text-sm md:text-base font-[900] px-6 py-3 mt-1 rounded-full border-[2px] md:border-[3px] border-[#231f20] shadow-[2px_2px_0_#000] hover:shadow-[3px_3px_0_#000] hover:-translate-y-1 transition-all"
            >
              INVIA
            </Button>
          </form>
        </div>
        
        {/* Right: Contact info */}
        <div className="flex w-full flex-col items-center space-y-4 text-center lg:w-6/12 lg:items-start lg:text-left md:space-y-6 lg:space-y-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[0.9] font-black text-white tracking-tighter uppercase drop-shadow-[3px_3px_0_#231f20] md:drop-shadow-[4px_4px_0_#231f20]">
            PARLA CON NOI
          </h2>
          
          <div className="flex w-full flex-col items-center gap-3 md:gap-4 lg:items-start">
            <div className="bg-white px-4 py-2 md:py-3 rounded-full border-[2px] border-[#231f20] shadow-[3px_3px_0_#000] transform -rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-xs sm:text-sm md:text-base font-[900] text-black lowercase">
                fantacer@fantacer.com
              </p>
            </div>
            
            <div className="bg-[#fccb27] px-4 py-2 md:py-3 rounded-full border-[2px] border-[#231f20] shadow-[3px_3px_0_#000] transform rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-xs sm:text-sm md:text-base font-[900] text-black tracking-widest">
                00 000 000
              </p>
            </div>
            
            <div className="bg-white px-4 py-2 md:py-3 rounded-full border-[2px] border-[#231f20] shadow-[3px_3px_0_#000] transform -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-1">
              <p className="text-xs sm:text-sm md:text-base font-[900] text-[#8000ff] lowercase">
                www.fantacer.com
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </section>
  )
}
