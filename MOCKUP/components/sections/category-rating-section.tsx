'use client'

import Image from 'next/image'

interface CategoryRatingSectionProps {
  companyName?: string
  categories?: { name: string; rating: number }[]
  onNext?: () => void
}

export function CategoryRatingSection({ 
  companyName = "Ceramica",
  onNext 
}: CategoryRatingSectionProps) {
  const categories = [
    { name: 'design', rating: 0 },
    { name: 'innovazione', rating: 0 },
    { name: 'wow effect', rating: 0 },
  ]

  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-lg md:text-xl mb-8">
          come valuti lo stand di <span className="text-mockup-orange font-bold">{companyName}</span> ?
        </p>
        
        <div className="space-y-8 mb-12">
          {categories.map((cat, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center gap-4">
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-mockup-purple w-full md:w-auto text-center md:text-left">
                {cat.name}
              </h3>
              <div className="flex-1 max-w-md">
                <Image
                  src="/88abf11b3ae5bbe4b5f50a3583be0986-png@2x.png"
                  alt={`Rating for ${cat.name}`}
                  width={336}
                  height={60}
                  className="w-full h-auto"
                />
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={onNext}
            className="bg-mockup-yellow hover:bg-[#c99900] text-black text-xl md:text-2xl font-bold px-16 py-4 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
          >
            &gt;&gt;
          </button>
        </div>
      </div>
    </section>
  )
}