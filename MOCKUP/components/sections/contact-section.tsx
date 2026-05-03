'use client'

import { Button } from '@/components/ui/button'

export function ContactSection() {
  return (
    <section id="contact-section" className="relative w-full min-h-[100dvh] bg-[linear-gradient(to_bottom,#4B00AB_0%,#FF8C23_50%,#FCCB27_100%)] flex items-center justify-center overflow-hidden py-16 md:py-24">
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col-reverse lg:flex-row items-center justify-between gap-8 lg:gap-16">
        
        {/* Left: Contact Form (Work in Progress) */}
        <div className="w-full lg:w-1/2 bg-white p-6 md:p-8 rounded-3xl border-[4px] border-[#231f20] shadow-[8px_8px_0_#000000]">
          <h3 className="text-[clamp(1.2rem,2.5vw,36px)] font-[900] text-black uppercase tracking-tighter mb-6 text-center lg:text-left">
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
              className="bg-[#8000ff] hover:bg-[#6b00d6] text-white text-xl md:text-2xl font-[900] px-10 py-6 mt-2 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all"
            >
              INVIA
            </Button>
          </form>
        </div>
        
        {/* Right: Contact info */}
        <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 lg:space-y-10">
          <h2 className="text-[clamp(2.5rem,5vw,80px)] leading-[0.9] font-black text-white tracking-tighter uppercase drop-shadow-[5px_5px_0_#231f20]">
            PARLA CON NOI
          </h2>
          
          <div className="flex flex-col gap-4 md:gap-6 w-full items-center lg:items-start">
            <div className="bg-white px-6 py-4 md:py-5 rounded-full border-[3px] border-[#231f20] shadow-[6px_6px_0_#000] transform -rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-lg md:text-xl lg:text-2xl font-[900] text-black lowercase">
                fantacer@fantacer.com
              </p>
            </div>
            
            <div className="bg-[#fccb27] px-6 py-4 md:py-5 rounded-full border-[3px] border-[#231f20] shadow-[6px_6px_0_#000] transform rotate-2 hover:rotate-0 transition-transform cursor-default">
              <p className="text-lg md:text-xl lg:text-2xl font-[900] text-black tracking-widest">
                00 000 000
              </p>
            </div>
            
            <div className="bg-white px-6 py-4 md:py-5 rounded-full border-[3px] border-[#231f20] shadow-[6px_6px_0_#000] transform -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-1">
              <p className="text-lg md:text-xl lg:text-2xl font-[900] text-[#8000ff] lowercase">
                www.fantacer.com
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </section>
  )
}