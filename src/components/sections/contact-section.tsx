'use client'

import { Button } from '@/components/ui/button'

export function ContactSection() {
  return (
    <section id="contact-section" className="relative app-screen w-full overflow-hidden bg-[linear-gradient(to_bottom,#4B00AB_0%,#a088db_40%,#efdeff_100%)]">
      <div className="safe-shell flex">
        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col-reverse items-center justify-center gap-10 px-4 md:px-8 lg:flex-row lg:gap-16">
        
        {/* Left: Contact Form (Work in Progress) */}
        <div className="w-full max-w-md rounded-3xl border-[4px] border-[#231f20] bg-white p-6 shadow-[6px_6px_0_#000] md:p-8 md:shadow-[8px_8px_0_#000] lg:w-5/12 lg:max-w-none">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-[900] text-black uppercase tracking-tighter mb-6 text-center lg:text-left leading-tight">
            Inviaci un messaggio
          </h3>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="text" 
              placeholder="NOME" 
              className="w-full px-5 py-3 md:py-4 text-base md:text-lg bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[4px_4px_0_#000] focus:-translate-y-1 transition-all"
            />
            <input 
              type="email" 
              placeholder="EMAIL" 
              className="w-full px-5 py-3 md:py-4 text-base md:text-lg bg-[#f5f5f5] text-black font-bold uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[4px_4px_0_#000] focus:-translate-y-1 transition-all"
            />
            <textarea 
              placeholder="MESSAGGIO..." 
              rows={3}
              className="w-full px-5 py-3 md:py-4 text-base md:text-lg bg-[#f5f5f5] text-black font-bold uppercase rounded-3xl border-[3px] border-[#231f20] focus:outline-none focus:bg-white focus:shadow-[4px_4px_0_#000] focus:-translate-y-1 transition-all resize-none"
            />
            <Button 
              type="submit"
              className="bg-[#8000ff] hover:bg-[#6b00d6] text-white text-base md:text-lg font-[900] px-10 py-6 mt-2 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all"
            >
              INVIA
            </Button>
          </form>
        </div>
        
        {/* Right: Contact info */}
        <div className="flex w-full flex-col items-center space-y-6 text-center lg:w-6/12 lg:items-start lg:text-left md:space-y-8 lg:space-y-10">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[0.9] font-black text-white tracking-tighter uppercase drop-shadow-[4px_4px_0_#231f20] md:drop-shadow-[5px_5px_0_#231f20]">
            PARLA CON NOI
          </h2>
          
          <div className="flex w-full flex-col items-center gap-4 md:gap-6 lg:items-start">
            <div className="bg-white px-6 py-3 md:py-4 rounded-full border-[3px] border-[#231f20] shadow-[5px_5px_0_#000] transform -rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-base sm:text-lg md:text-xl font-[900] text-black lowercase">
                fantacer@fantacer.com
              </p>
            </div>
            
            <div className="bg-[#fccb27] px-6 py-3 md:py-4 rounded-full border-[3px] border-[#231f20] shadow-[5px_5px_0_#000] transform rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-base sm:text-lg md:text-xl font-[900] text-black tracking-widest">
                00 000 000
              </p>
            </div>
            
            <div className="bg-white px-6 py-3 md:py-4 rounded-full border-[3px] border-[#231f20] shadow-[5px_5px_0_#000] transform -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-1">
              <p className="text-base sm:text-lg md:text-xl font-[900] text-[#8000ff] lowercase">
                www.fantacer.com
              </p>
            </div>
          </div>
        </div>
        
        </div>
      </div>
    </section>
  )
}
