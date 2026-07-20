export function PrizeLocationSection() {
  return (
    <section className="snap-start relative w-full h-[100dvh] bg-[linear-gradient(to_bottom,#4B00AB_0%,#4B00AB_30%,#8A2BE2_60%,#E0B0FF_85%,#FFFFFF_100%)] text-white flex flex-col items-center justify-center overflow-hidden">
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-col items-center justify-center h-full py-8 md:py-12 gap-6 md:gap-8">

        {/* Main Title */}
        <h2 className="text-[clamp(2rem,6vw,4.5rem)] font-[900] text-[#ff8a26] tracking-tighter lowercase leading-[1.1] text-center md:whitespace-nowrap w-full">
          e ritira il tuo premio qui
        </h2>

        {/* Logo Cards — side by side, big on mobile */}
        <div className="flex flex-row justify-center items-center gap-6 sm:gap-8 md:gap-12">
          {/* Card 1 (Ready for Logo) */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 max-h-[20dvh] bg-white rounded-3xl md:rounded-4xl shadow-[6px_6px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
          </div>
          {/* Card 2 (Ready for Logo) */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 max-h-[20dvh] bg-white rounded-3xl md:rounded-4xl shadow-[6px_6px_0px_0px_#000] border-[3px] md:border-[4px] border-black flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-2">
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[clamp(1.15rem,3.5vw,2.625rem)] text-center text-white font-medium leading-[1.35] max-w-[92%] w-full [text-shadow:0_0_12px_rgba(0,0,0,0.5),2px_2px_0px_#000] drop-shadow-[2px_2px_0px_#000]">
          all&apos;interno di <strong className="font-[900]">Cersaie, a Bologna Fiere</strong>
          <br />
          <span className="block mt-2 md:mt-4 font-[900]">dal 21 al 25 settembre 2026</span>
        </p>

      </div>
    </section>
  )
}