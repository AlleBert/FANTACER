'use client'

import Image from 'next/image'
import { Input } from '@/components/ui/input'

interface SearchSectionProps {
  onSearch?: (query: string) => void
}

export function SearchSection({ onSearch }: SearchSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32 text-[#8000ff]">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-12 tracking-tight">
          vota la tua azienda preferita
        </h2>
        
        {/* Search input - rounded pill shape */}
        <div className="relative max-w-xl mx-auto">
          <Input
            type="text"
            placeholder="cerca"
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full bg-[#c2e1ff] border-2 border-[#231f20] rounded-full px-8 py-4 text-lg font-bold text-center"
          />
        </div>
        
        {/* Decorative image - right side */}
        <Image
          src="/e883cd33-c802-43cb-a42a-cc3ab534b159@2x.png"
          alt=""
          width={102}
          height={104}
          className="absolute right-8 md:right-16 bottom-8 md:bottom-16 w-16 h-16 md:w-20 md:h-20 object-contain hidden md:block"
        />
      </div>
    </section>
  )
}