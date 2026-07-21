import { ChevronDown } from 'lucide-react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'

export function IntroSection() {
  return (
    <section className="snap-start relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#FF8C23_0%,#FF2FB2_50%,#4B00AB_100%)]">
      {/* Seamless transition overlay to Section 3 */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-[#FF8A26] pointer-events-none" />

      <div className="safe-shell h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full max-w-7xl mx-auto">
          <h1 className="text-[clamp(2.5rem,7.5vw,4.5rem)] font-open-sauce font-black text-white tracking-[-0.05em] leading-[1.1] md:leading-[0.9] lowercase max-w-[14ch]">
            il primo gioco<br />
            semiserio del<br />
            distretto ceramico
          </h1>

          <p className="mt-4 lg:mt-6 text-[clamp(1.25rem,2.5vw,2.25rem)] font-open-sauce font-medium text-white leading-[1.2] [text-wrap:balance] max-w-[20ch]">
            usa il cellulare per qualcosa di davvero importante!
          </p>

          <SponsorCards className="mt-8 md:mt-12" />
        </div>

        <div className="flex flex-col items-center gap-2 pb-4 md:pb-6 animate-bounce">
          <span className="text-[clamp(0.625rem,1.5vw,0.75rem)] font-[700] text-white/50 tracking-[0.15em] uppercase">scopri</span>
          <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-white/50" />
        </div>
      </div>
    </section>
  )
}
