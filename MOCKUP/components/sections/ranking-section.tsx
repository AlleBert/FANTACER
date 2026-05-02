'use client'

import { RankingOption } from '@/components/ranking-option'
import { Button } from '@/components/ui/button'

interface RankingSectionProps {
  companyName?: string
  onSelect?: (ranking: string) => void
}

const rankingOptions = [
  'eccezionale',
  'migliore',
  'nella media',
  'peggiore',
]

export function RankingSection({ 
  companyName = "Ceramica Mimma", 
  onSelect 
}: RankingSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4">
        {/* Question */}
        <p className="text-base md:text-lg lg:text-xl text-center mb-8">
          rispetto agli altri stand che hai visto, quello di <span className="text-[#ff803b] font-bold">{companyName}</span> è ...
        </p>
        
        {/* Options grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-xl mx-auto">
          {rankingOptions.map((option) => (
            <RankingOption
              key={option}
              label={option}
              onClick={() => onSelect?.(option)}
            />
          ))}
        </div>
        
        {/* Next button */}
        <div className="flex justify-center">
          <Button className="bg-[#fccb27] hover:bg-[#c99900] text-black text-xl md:text-2xl font-bold px-16 py-4 rounded-full border-2 border-[#231f20]">
            &gt;&gt;
          </Button>
        </div>
      </div>
    </section>
  )
}