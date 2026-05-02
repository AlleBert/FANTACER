'use client'

import Image from 'next/image'
import { Input } from '@/components/ui/input'

interface SearchSectionProps {
  onSearch?: (query: string) => void
}

export function SearchSection({ onSearch }: SearchSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 tracking-tight text-mockup-purple">
          vota la tua azienda preferita
        </h2>
        
        <div className="relative max-w-xl mx-auto">
          <Input
            type="text"
            placeholder="cerca"
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full bg-mockup-blue border-2 border-[#231f20] rounded-full px-8 py-4 text-lg font-bold text-center"
          />
        </div>
        
        <Image
          src="/e883cd33-c802-43cb-a42a-cc3ab534b159@2x.png"
          alt=""
          width={102}
          height={104}
          className="absolute right-16 bottom-16 w-20 h-20 object-contain hidden md:block"
        />
      </div>
    </section>
  )
}