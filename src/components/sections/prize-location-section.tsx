'use client'

export function PrizeLocationSection() {
  return (
    <section className="relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#4B00AB_0%,#4B00AB_30%,#8A2BE2_60%,#E0B0FF_85%,#FFFFFF_100%)] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="safe-shell w-full max-w-[1200px] mx-auto flex flex-col items-center justify-evenly h-full py-10 md:py-12 gap-0">

        {/* Main Title */}
        <h2 className="text-[clamp(2.2rem,7.5vw,91px)] font-[900] text-[#ff803b] tracking-tighter lowercase leading-[1.1] text-center md:whitespace-nowrap w-full">
          e ritira il tuo premio qui
        </h2>

        {/* Logo Cards — side by side, big on mobile */}
        <div className="flex flex-row justify-center items-center gap-8 sm:gap-12 md:gap-20">
          {/* Card 1 (Ready for Logo) */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 bg-white rounded-3xl md:rounded-[2.5rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
          </div>
          {/* Card 2 (Ready for Logo) */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 bg-white rounded-3xl md:rounded-[2.5rem] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[clamp(1.15rem,3.5vw,42px)] text-center text-white font-medium leading-[1.35] max-w-[92%] w-full drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          all&apos;interno di <strong className="font-[900]">Cersaie, a Bologna Fiere</strong>
          <br />
          <span className="block mt-2 md:mt-4 font-[900]">dal 21 al 25 settembre 2026</span>
        </p>

      </div>
    </section>
  )
}