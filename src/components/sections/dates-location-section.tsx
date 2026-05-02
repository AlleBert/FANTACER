'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'

export function DatesLocationSection() {
  return (
    <SectionContainer className="bg-[#6B21A8]" id="dates-location-section" fullHeight={false}>
      <div className="flex flex-col items-center gap-8 text-center py-8">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-4xl font-bold text-white max-w-2xl"
        >
          all’interno di Cersaie, a Bologna Fiere, <br className="hidden md:block"/>
          dal 21 al 25 settembre 2026
        </motion.p>
        
        <div className="flex gap-12 items-center justify-center grayscale brightness-200 opacity-80">
          <div className="text-2xl font-black text-white">LOGO X</div>
          <div className="text-2xl font-black text-white">LOGO Y</div>
        </div>
      </div>
    </SectionContainer>
  )
}
