'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'

interface InnovationSectionProps {
  companyName?: string
  onSelect?: (answers: string[]) => void
  onNext?: () => void
}

interface Option {
  left: string
  right: string
}

const options: Option[] = [
  { left: 'vere novità', right: 'cose già viste' },
  { left: 'molto vendibili', right: 'di nicchia' },
  { left: 'wow effect', right: 'normale' },
]

export function InnovationSection({ 
  companyName = "Ceramica Mimma", 
  onSelect,
  onNext 
}: InnovationSectionProps) {
  
  // Track 0-100 values for the 3 sliders (start in the middle at 50)
  const [sliderValues, setSliderValues] = useState<number[]>([50, 50, 50])

  const handleNext = () => {
    if (onNext) {
      onNext()
      return
    }
    const currentSection = document.getElementById('innovation-section')
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
    <section id="innovation-section" className="relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden py-10 md:py-16 lg:py-20">
      <div className="w-full h-full max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col items-center justify-between">
        
        {/* Question */}
        <p className="text-[clamp(1.125rem,3.5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-3xl mx-auto flex-none">
          per te, le novità di <span className="text-[#ff803b] underline decoration-4 underline-offset-4">{companyName}</span> sono più...
        </p>
        
        <div className="flex-1 min-h-[4vh]" />
        
        {/* Options */}
        <div className="space-y-12 md:space-y-16 w-full max-w-5xl mx-auto flex-none">
          {options.map((option, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 lg:gap-12 w-full">
              <h3 className="text-[clamp(1.2rem,2.5vw,36px)] font-[900] text-[#8000ff] text-center md:text-right uppercase tracking-tighter w-full md:w-[30%] leading-[1.1]">
                {option.left}
              </h3>
              
              {/* Interactive Range Slider mapped to Star */}
              <div className="relative flex-1 w-full h-16 flex items-center group md:max-w-[40%]">
                
                {/* Visual Track - Sleek Solid Line */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] bg-black rounded-full" />
                
                {/* Visual Thumb */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-75"
                  style={{ left: `${sliderValues[index]}%` }}
                >
                  <Star className="w-12 h-12 md:w-16 md:h-16 lg:w-[72px] lg:h-[72px] fill-[#fccb27] stroke-[#231f20] stroke-[2px] drop-shadow-[2px_2px_0_#000]" />
                </div>
                
                {/* Hidden input controlling the slider */}
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={sliderValues[index]}
                  onChange={(e) => {
                    const newValues = [...sliderValues]
                    newValues[index] = Number(e.target.value)
                    setSliderValues(newValues)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0 p-0"
                />
              </div>
              
              <h3 className="text-[clamp(1.2rem,2.5vw,36px)] font-[900] text-[#8000ff] text-center md:text-left uppercase tracking-tighter w-full md:w-[30%] leading-[1.1]">
                {option.right}
              </h3>
            </div>
          ))}
        </div>
        
        <div className="flex-1 min-h-[4vh]" />
        
        {/* Submit button */}
        <div className="flex justify-center w-full flex-none">
          <Button 
            onClick={handleNext}
            className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem]"
          >
            FATTO!
          </Button>
        </div>
        
      </div>
    </section>
  )
}