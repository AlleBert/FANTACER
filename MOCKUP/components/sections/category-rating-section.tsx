'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface CategoryRatingSectionProps {
  companyName?: string
  onNext?: () => void
}

const categories = [
  'design',
  'innovazione',
  'wow effect',
]

export function CategoryRatingSection({ 
  companyName = "Ceramica", 
  onNext 
}: CategoryRatingSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4">
        {/* Question */}
        <p className="text-base md:text-lg lg:text-xl text-center mb-8">
          come valuti lo stand di <span className="text-[#ff803b] font-bold">{companyName}</span> ?
        </p>
        
        {/* Categories with rating bars */}
        <div className="space-y-8 mb-12">
          {categories.map((cat, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#8000ff] w-full md:w-auto text-center md:text-left min-w-[10rem]">
                {cat}
              </h3>
              <div className="flex-1 max-w-md w-full">
                <Image
                  src="/88abf11b3ae5bbe4b5f50a3583be0986-png@2x.png"
                  alt={`Rating for ${cat}`}
                  width={336}
                  height={60}
                  className="w-full h-auto"
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Next button */}
        <div className="flex justify-center">
          <Button
            onClick={onNext}
            className="bg-[#fccb27] hover:bg-[#c99900] text-black text-xl md:text-2xl font-bold px-16 py-4 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
          >
            &gt;&gt;
          </Button>
        </div>
      </div>
    </section>
  )
}