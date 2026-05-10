'use client'

import { Button } from '@/components/ui/button'

export function ContactSection() {
  return (
    <section
      id="contact-section"
      className="snap-start relative w-full overflow-hidden bg-[linear-gradient(to_bottom,#4B00AB_0%,#a088db_40%,#efdeff_100%)]"
    >
      {/* safe-shell gestisce min-height, safe area e padding laterale */}
      <div className="safe-shell flex flex-col items-center justify-center gap-2 md:gap-4 lg:gap-8">
        <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-6 md:gap-8 lg:flex-row-reverse lg:gap-16">

          {/* Top mobile / Right desktop: info */}
          <div className="flex w-full flex-col items-center gap-4 md:gap-6 text-center lg:w-1/2 lg:items-start lg:text-left">
            <h2 className="text-[clamp(2rem,7vw,90px)] font-[900] text-white tracking-tighter uppercase leading-[0.9] drop-shadow-[2px_2px_0_#231f20]">
              PARLA<br className="sm:hidden"/>
              <span className="hidden sm:inline"> </span>CON NOI
            </h2>

            <div className="flex w-full flex-col items-center gap-2 md:gap-4 lg:gap-12 lg:items-start">
              <div className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black lowercase">fantacer@fantacer.com</p>
              </div>
              <div className="bg-[#fccb27] px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] rotate-2 hover:rotate-0 transition-transform cursor-default">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-black tracking-wider">00 000 000</p>
              </div>
              <div className="bg-white px-6 py-4 sm:py-5 md:py-6 lg:py-8 rounded-full border-2 border-[#231f20] shadow-[3px_3px_0_#000] -rotate-1 hover:rotate-0 transition-transform cursor-pointer hover:-translate-y-0.5">
                <p className="text-[clamp(1.1rem,2.5vw,1.4rem)] font-black text-[#8000ff] lowercase">www.fantacer.com</p>
              </div>
            </div>
          </div>

          {/* Bottom mobile / Left desktop: form */}
          <div className="w-full lg:w-1/2 rounded-3xl border-[3px] border-[#231f20] bg-white p-4 md:p-6 lg:p-12 shadow-[6px_6px_0_#000]">
            <h3 className="text-[clamp(1rem,2.5vw,1.75rem)] font-black text-black uppercase tracking-tighter mb-2 md:mb-4 lg:mb-8 text-center leading-tight">
              Inviaci un messaggio
            </h3>
            <form className="flex flex-col gap-3 md:gap-4 lg:gap-6" onSubmit={(e) => e.preventDefault()}>
              <input
                type="text"
                placeholder="NOME"
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-black uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <input
                type="email"
                placeholder="EMAIL"
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-black uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all"
              />
              <textarea
                placeholder="MESSAGGIO..."
                rows={4}
                className="w-full px-5 py-2 md:py-3 lg:py-5 text-[clamp(0.8rem,1.5vw,1rem)] bg-white text-black font-black uppercase rounded-full border-[3px] border-[#231f20] focus:outline-none focus:shadow-[4px_4px_0_#000] focus:-translate-y-0.5 shadow-[2px_2px_0_#000] transition-all resize-none"
              />
              <Button
                type="submit"
                className="bg-[#8000ff] hover:bg-[#6b00d6] text-[clamp(0.875rem,1.5vw,1.125rem)] font-black px-6 py-2 md:py-3 lg:py-6 mt-1 rounded-full border-[3px] border-[#231f20] shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all"
              >
                INVIA
              </Button>
            </form>
          </div>

        </div>
      </div>
    </section>
  )
}