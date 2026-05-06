'use client'

export function IntroSection() {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#FF8C23_0%,#FF2FB2_50%,#4B00AB_100%)]">
      {/* Seamless transition overlay to Section 3 */}
      <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-b from-transparent to-[#FF8A26] pointer-events-none" />

      <div className="safe-shell flex">
        <div className="relative z-10 mx-auto grid flex-1 w-full max-w-[1440px] items-center gap-12 px-4 md:px-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24 lg:px-24">
          {/* Left: iPhone like in penultimate slide */}
          <div className="relative flex flex-col items-center lg:items-start flex-shrink-0">
            <div className="relative w-[min(80vw,350px)] h-[min(80vw,350px)] md:w-[min(60vw,450px)] md:h-[min(60vw,450px)] lg:w-[min(40vw,520px)] lg:h-[min(40vw,520px)] xl:w-[550px] xl:h-[550px]">
              {/* Orange hand shape background */}
              <svg className="absolute inset-0 w-full h-full z-[-1]" viewBox="0 0 421 421">
                <path
                  d="M135.828 13.56C145.428 1.55999 161.728 -2.84006 176.028 2.75994L197.328 11.06C205.628 14.26 214.728 14.26 222.928 11.06L244.228 2.75994C258.528 -2.84006 274.828 1.55999 284.428 13.56L298.828 31.46C304.328 38.26 312.228 42.86 320.928 44.16L343.528 47.66C358.728 49.96 370.628 61.96 373.028 77.06L376.428 99.7599C377.828 108.46 382.328 116.36 389.228 121.86L407.128 136.16C419.128 145.76 423.428 162.06 417.928 176.36L409.528 197.76C406.328 205.96 406.328 215.06 409.528 223.26L417.928 244.66C423.428 258.96 419.128 275.26 407.128 284.86L389.228 299.16C382.328 304.66 377.828 312.56 376.428 321.26L373.028 343.96C370.628 359.16 358.728 371.06 343.528 373.36L320.928 376.86C312.228 378.16 304.328 382.76 298.828 389.66L284.428 407.46C274.828 419.46 258.528 423.86 244.228 418.26L222.928 409.96C214.728 406.76 205.628 406.76 197.328 409.96L176.028 418.26C161.728 423.86 145.428 419.46 135.828 407.46L121.528 389.66C116.028 382.76 108.128 378.16 99.328 376.86L76.728 373.36C61.528 371.06 49.628 359.16 47.328 343.96L43.828 321.26C42.528 312.56 37.928 304.66 31.028 299.16L13.128 284.86C1.12804 275.26 -3.17197 258.96 2.42803 244.66L10.728 223.26C13.928 215.06 13.928 205.96 10.728 197.76L2.42803 176.36C-3.17197 162.06 1.12804 145.76 13.128 136.16L31.028 121.86C37.928 116.36 42.528 108.46 43.828 99.7599L47.328 77.06C49.628 61.96 61.528 49.96 76.728 47.66L99.328 44.16C108.128 42.86 116.028 38.26 121.528 31.46L135.828 13.56Z"
                  fill="#FF8C23"
                />
              </svg>

              {/* Phone frame */}
              <img
                src="/iphone2.svg"
                alt="iPhone"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 scale-90 md:scale-75"
              />
            </div>
          </div>

          {/* Right: Exactly Layouted & Paginated Text Block */}
          <div className="text-center lg:text-left w-full max-w-[90vw] mx-auto lg:max-w-none lg:mx-0">
            <h1 className="text-[min(9vw,4.5rem)] lg:text-[min(5vw,4.5rem)] xl:text-[72px] font-open-sauce font-black text-white tracking-[-0.05em] leading-[1.1] md:leading-[0.9] lowercase whitespace-pre">
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
