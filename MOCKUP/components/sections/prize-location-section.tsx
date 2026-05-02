'use client'

export function PrizeLocationSection() {
  return (
    <section className="relative w-full bg-[#4f03aa] text-white py-16 md:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-12">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 lg:mb-16 tracking-tight" style={{ color: '#ff803b' }}>
          e ritira il tuo premio qui
        </h2>
        
        {/* Logo area - two placeholders */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 lg:gap-16 mb-12">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            logo X
          </h3>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            logo Y
          </h3>
        </div>
        
        <p className="text-base md:text-lg lg:text-xl text-center text-gray-200">
          all&apos;interno di <strong>Cersaie, a Bologna Fiere</strong>,
          <br />
          dal 21 al 25 settembre 2026
        </p>
      </div>
    </section>
  )
}