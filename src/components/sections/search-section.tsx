'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface SearchSectionProps {
  onSearch?: (query: string) => void
}

export function SearchSection({ onSearch }: SearchSectionProps) {
  return (
    <section className="relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(194,225,255,0.2)_0%,rgba(255,255,255,1)_100%)] text-[#8000ff]">
      <div className="safe-shell flex">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center justify-center px-4 md:px-8">
          {/* Main Title - Responsive & Lowercase */}
          <h2 className="text-[clamp(2.5rem,7.5vw,91px)] font-[900] text-center mb-[clamp(3rem,8vh,5rem)] tracking-tighter lowercase leading-[1.1] md:whitespace-nowrap w-full text-[#8000ff]">
            vota la tua azienda preferita
          </h2>
          
          {/* Search input container - embedding Lucide icon */}
          <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
            <div className="relative w-full">
              <Input
                type="text"
                placeholder="CERCA"
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-full bg-[#c2e1ff] border-[3px] md:border-[4px] border-[#231f20] rounded-full pl-8 pr-16 md:pr-24 h-20 md:h-24 text-[clamp(1.5rem,4vw,32px)] md:text-[40px] font-[900] text-left shadow-[6px_6px_0_#000] placeholder:text-black/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 focus:bg-white focus:shadow-[8px_8px_0_#000] focus:-translate-y-1"
              />
              
              {/* Embedded Search Icon */}
              <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <Search className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
