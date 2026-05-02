'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface InnovationSectionProps {
  companyName?: string
  onSelect?: (answers: string[]) => void
}

interface Option {
  left: string
  right: string
  line: string
}

const options: Option[] = [
  { left: 'vere novità', right: 'cose già viste', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
  { left: 'molto vendibili', right: 'di nicchia', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
  { left: 'wow effect', right: 'wow effect', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
]

export function InnovationSection({ companyName = "Ceramica Mimma", onSelect }: InnovationSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4">
        {/* Question */}
        <p className="text-base md:text-lg lg:text-xl text-center mb-8">
          per te, le novità di <span className="text-[#ff803b] font-bold">{companyName}</span> sono più...
        </p>
        
        {/* Options */}
        <div className="space-y-8 mb-12">
          {options.map((option, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#8000ff] text-center md:text-left">
                {option.left}
              </h3>
              
              {/* Divider line */}
              <div className="flex-1 max-w-xs relative h-1">
                <Image
                  src={option.line}
                  alt=""
                  width={376}
                  height={2}
                  className="w-full h-auto"
                />
              </div>
              
              <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#8000ff] text-center md:text-right">
                {option.right}
              </h3>
            </div>
          ))}
        </div>
        
        {/* Submit button */}
        <div className="flex justify-center">
          <Button 
            onClick={() => onSelect?.(['option1', 'option2', 'option3'])}
            className="bg-[#fccb27] hover:bg-[#c99900] text-black text-xl md:text-2xl font-bold px-12 py-4 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
          >
            fatto!
          </Button>
        </div>
      </div>
      
      {/* Decorative image - bottom right */}
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={54}
        height={53}
        className="absolute right-8 bottom-8 w-10 h-10 md:w-12 md:h-12 object-contain"
      />
    </section>
  )
}