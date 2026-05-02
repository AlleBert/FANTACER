'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'

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
  
  // Track 1-5 star ratings for each category by index or name
  const [ratings, setRatings] = useState<Record<string, number>>({})

  // Handle setting a rating
  const handleRating = (cat: string, value: number) => {
    setRatings(prev => ({ ...prev, [cat]: value }))
  }

  // Handle proceeding to the next section
  const handleNext = () => {
    if (onNext) {
      onNext()
      return
    }
    
    // Smooth scrolling to the next snap section in the DOM
    const currentSection = document.getElementById('rating-section')
    if (currentSection) {
      // The section is wrapped in a <div className="snap-start"> in page.tsx
      const wrapper = currentSection.parentElement
      if (wrapper && wrapper.nextElementSibling) {
        wrapper.nextElementSibling.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    // Fallback if structure changes
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
  }

  return (
    <section id="rating-section" className="relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden py-10 md:py-16 lg:py-20">
      <div className="w-full h-full max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col items-center justify-between">
        
        {/* Question */}
        <p className="text-[clamp(1.125rem,3.5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-3xl mx-auto flex-none">
          come valuti lo stand di <span className="text-[#ff803b] underline decoration-4 underline-offset-4">{companyName}</span> ?
        </p>
        
        <div className="flex-1 min-h-[4vh]" />
        
        {/* Categories with 5-Star Rating blocks */}
        <div className="space-y-6 md:space-y-10 w-full max-w-4xl mx-auto flex-none">
          {categories.map((cat, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-16 w-full">
              <h3 className="text-[clamp(1.5rem,3.5vw,48px)] font-[900] text-[#8000ff] w-full md:w-1/2 text-center md:text-left uppercase tracking-tighter leading-[1]">
                {cat}
              </h3>
              
              {/* Star Rating Group */}
              <div className="flex gap-3 sm:gap-6 items-center w-full md:w-1/2 justify-center md:justify-end mt-4 md:mt-0">
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const currentRating = ratings[cat] || 0;
                  const isActive = starValue <= currentRating;
                  
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => handleRating(cat, starValue)}
                      className="group transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star 
                        className={`w-12 h-12 sm:w-16 sm:h-16 lg:w-[72px] lg:h-[72px] transition-all duration-200 stroke-[#231f20] stroke-[2px] cursor-pointer ${
                          isActive 
                            ? 'fill-[#fccb27] scale-110 drop-shadow-[2px_2px_0_#000]' 
                            : 'fill-transparent hover:fill-[#ffe066]'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex-1 min-h-[4vh]" />

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