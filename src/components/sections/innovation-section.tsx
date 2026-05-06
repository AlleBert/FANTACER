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

const renderLabel = (text: string) => {
  const words = text.split(' ')
  return words.map((word, index) => (
    <span key={index} className="block sm:inline">
      {word}
      {index < words.length - 1 ? '\u00A0' : ''}
    </span>
  ))
}

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
    <section id="innovation-section" className="relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden">
      <div className="safe-shell flex flex-col items-center justify-between max-w-[1200px] mx-auto">

        {/* Question */}
        <p className="text-[clamp(2rem,5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-4xl mx-auto flex-none pt-4">
          per te, le novità di <span className="text-[#ff803b] underline decoration-4 underline-offset-4">{companyName}</span> sono più...
        </p>

        <div className="flex-1 min-h-[2vh]" />

        {/* Options */}
        <div className="space-y-10 md:space-y-14 w-full max-w-5xl mx-auto flex-none">
          {options.map((option, index) => (
            <div key={index} className="flex flex-row items-center justify-center gap-4 md:gap-12 w-full py-2">
              <div className="flex-none basis-[25%] md:basis-[20%] flex items-center justify-end">
                <h3 className="text-[clamp(1rem,3vw,26px)] md:text-[clamp(1.35rem,3.8vw,38px)] font-[900] text-[#8000ff] text-right uppercase tracking-tighter leading-[1.05]">
                  {renderLabel(option.left)}
                </h3>
              </div>
              
              {/* Interactive Range Slider mapped to Star */}
              <div className="relative flex-none basis-[45%] md:basis-[56%] w-full h-16 flex items-center group px-16 md:px-24 lg:px-44">
                
                {/* Visual Track - Sleek Solid Line */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] bg-black rounded-full" />
                
                {/* Visual Thumb */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-75"
                  style={{ left: `${sliderValues[index]}%` }}
                >
                  <Star className="w-10 h-10 sm:w-12 sm:h-12 md:w-18 md:h-18 lg:w-[84px] lg:h-[84px] fill-[#fccb27] stroke-[#231f20] stroke-[2px] drop-shadow-[2px_2px_0_#000]" />
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
                  style={{ touchAction: 'pan-x' }}
                />
              </div>
              
              <div className="flex-none basis-[25%] md:basis-[20%] flex items-center justify-start">
                <h3 className="text-[clamp(1rem,3vw,26px)] md:text-[clamp(1.35rem,3.8vw,38px)] font-[900] text-[#8000ff] text-left uppercase tracking-tighter leading-[1.05]">
                  {renderLabel(option.right)}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-[2vh]" />

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