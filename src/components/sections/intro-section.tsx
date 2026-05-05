'use client'

import Image from 'next/image'

export function IntroSection() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#FF8C23_0%,#FF2FB2_50%,#4B00AB_100%)]">
      {/* Seamless transition overlay to Section 3 */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-[#FF8A26] pointer-events-none" />

      <div className="safe-shell flex">
        <div className="relative z-10 mx-auto grid flex-1 w-full max-w-[1440px] items-center gap-12 px-4 md:px-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24 lg:px-24">
          {/* Left: Hand holding iPhone - larger and adaptive size */}
          <div className="relative flex flex-col items-center lg:items-start flex-shrink-0">
            <div className="relative w-[min(80vw,350px)] h-[min(80vw,350px)] md:w-[min(60vw,450px)] md:h-[min(60vw,450px)] lg:w-[min(40vw,520px)] lg:h-[min(40vw,520px)] xl:w-[550px] xl:h-[550px]">
              <Image
                src="/hand-holding-iphone.svg"
                alt=""
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* GIOCA text overlaid on the iPhone screen */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* We position it relatively to overlay exactly on the phone screen area */}
              <h2
                className="text-xl md:text-2xl font-open-sauce font-bold mt-[55%] lg:mt-[50%] tracking-tight"
                style={{ color: '#000000' }}
              >
                GIOCA
              </h2>
            </div>
          </div>

          {/* Right: Exactly Layouted & Paginated Text Block */}
          <div className="text-center lg:text-left lg:ml-16 w-full max-w-[90vw] mx-auto lg:max-w-none lg:mx-0">
            <h1 className="text-[min(9vw,4.5rem)] lg:text-[min(5vw,4.5rem)] xl:text-[72px] font-open-sauce font-black text-white tracking-[-0.05em] leading-[0.9] lowercase whitespace-pre">
{`il primo gioco
semiserio del
distretto ceramico`}
            </h1>

            <p className="mt-4 lg:mt-6 text-[clamp(1.25rem,2.5vw,2.25rem)] font-open-sauce font-medium text-white leading-[1.2]">
              usa il cellulare per qualcosa di davvero importante!
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
