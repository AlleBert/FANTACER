'use client'

export function PrizeLocationSection() {
  return (
    <section className="relative w-full bg-mockup-dark text-white py-16 md:py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16 tracking-tight text-mockup-orange">
          e ritira il tuo premio qui
        </h2>
        
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 mb-12">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            logo X
          </h3>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            logo Y
          </h3>
        </div>
        
        <p className="text-center text-lg md:text-xl text-gray-200">
          all&apos;interno di Cersaie, a Bologna Fiere,
          <br />
          dal 21 al 25 settembre 2026
        </p>
      </div>
    </section>
  )
}