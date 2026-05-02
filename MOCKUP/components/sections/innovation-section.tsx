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
  line?: string
}

export function InnovationSection({ companyName = "Ceramica Mimma", onSelect }: InnovationSectionProps) {
  const options: Option[] = [
    { left: 'vere novità', right: 'cose già viste', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
    { left: 'molto vendibili', right: 'di nicchia', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
    { left: 'wow effect', right: 'wow effect', line: '/e8f6eb6a-c1f9-4e90-a6ed-f7712186f897@2x.png' },
  ]

  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-lg md:text-xl mb-8">
          per te, le novità di <span className="text-mockup-orange font-bold">{companyName}</span> sono più...
        </p>
        
        <div className="space-y-8 mb-12">
          {options.map((option, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center justify-between gap-4">
              <h3 className="text-2xl md:text-3xl font-bold text-mockup-purple text-center md:text-left">
                {option.left}
              </h3>
              
              <div className="flex-1 max-w-xs relative h-2">
                {option.line && (
                  <Image
                    src={option.line}
                    alt=""
                    width={376}
                    height={2}
                    className="w-full h-auto"
                  />
                )}
              </div>
              
              <h3 className="text-2xl md:text-3xl font-bold text-mockup-purple text-center md:text-right">
                {option.right}
              </h3>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center">
          <Button 
            onClick={() => onSelect?.(['option1', 'option2', 'option3'])}
            className="bg-mockup-yellow hover:bg-[#c99900] text-black text-xl md:text-2xl font-bold px-12 py-4 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors"
          >
            fatto!
          </Button>
        </div>
      </div>
      
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={54}
        height={53}
        className="absolute right-16 bottom-16 w-12 h-12 object-contain"
      />
    </section>
  )
}