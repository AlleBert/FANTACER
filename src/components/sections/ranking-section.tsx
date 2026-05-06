'use client'
import { useState } from 'react'

import { RankingOption } from '@/components/ranking-option'
import { Button } from '@/components/ui/button'

interface RankingSectionProps {
  companyName?: string
  onSelect?: (ranking: string) => void
  onNext?: () => void
}

const rankingOptions = [
  'eccezionale',
  'migliore',
  'nella media',
  'peggiore',
]

export function RankingSection({ 
  companyName = "Ceramica Mimma", 
  onSelect,
  onNext
}: RankingSectionProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (option: string) => {
    setSelected(option)
    onSelect?.(option)
  }

  // Handle proceeding to the next section cleanly snapping to boundaries
  const handleNext = () => {
    if (onNext) {
      onNext()
      return
    }
    const currentSection = document.getElementById('ranking-section')
    if (currentSection) {
      const wrapper = currentSection.parentElement
      if (wrapper && wrapper.nextElementSibling) {
        wrapper.nextElementSibling.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
  }

  return (
    <section id="ranking-section" className="snap-start relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden">
      <div className="safe-shell flex flex-col items-center justify-between max-w-[1200px] mx-auto">
        {/* Question */}
        <p className="text-[clamp(1.5rem,5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-4xl mx-auto flex-none pt-4">
          rispetto agli altri stand che hai visto, quello di <span className="text-[#ff803b] underline decoration-2 underline-offset-4">{companyName}</span> è ...
        </p>
        
        <div className="flex-1 min-h-[2vh]" />

        {/* Options stack */}
        <div className="flex flex-col gap-4 md:gap-6 w-full max-w-md mx-auto flex-none">
          {rankingOptions.map((option) => (
            <RankingOption
              key={option}
              label={option}
              isSelected={selected === option}
              onClick={() => handleSelect(option)}
            />
          ))}
        </div>
        
        <div className="flex-1 min-h-[2vh]" />

        {/* Next button */}
        <div className="flex justify-center w-full flex-none">
          <Button
            onClick={handleNext}
            className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem]"
          >
            &gt;&gt;
          </Button>
        </div>
      </div>
    </section>
  )
}