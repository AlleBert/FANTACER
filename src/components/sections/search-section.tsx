'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'
import { Search } from 'lucide-react'

interface SearchSectionProps {
  onSearch: (query: string) => void
}

export function SearchSection({ onSearch }: SearchSectionProps) {
  return (
    <SectionContainer className="bg-[#FF8C00]" id="search-section" fullHeight={false}>
      <div className="flex flex-col items-center gap-8 w-full">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-4xl md:text-7xl font-black text-white text-center italic"
        >
          vota la tua azienda preferita
        </motion.h2>

        <div className="relative w-full max-w-3xl group">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#FF8C00]">
            <Search size={32} strokeWidth={3} />
          </div>
          <input
            type="text"
            placeholder="cerca"
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-20 md:h-24 pl-20 pr-8 bg-white rounded-full text-2xl md:text-4xl font-bold text-[#FF8C00] placeholder:text-[#FF8C00]/50 outline-none focus:ring-8 focus:ring-white/30 transition-all shadow-2xl"
          />
        </div>
      </div>
    </SectionContainer>
  )
}
