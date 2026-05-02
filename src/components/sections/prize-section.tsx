'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'

export function PrizeSection() {
  return (
    <SectionContainer className="bg-[#6B21A8]" id="prize-section" fullHeight={false}>
      <div className="flex flex-col items-center gap-12 text-center py-16">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-4xl md:text-8xl font-black text-white italic"
        >
          e ritira il tuo premio qui
        </motion.h2>
        
        <div className="grid grid-cols-2 gap-12 max-w-2xl w-full">
           <div className="aspect-square bg-white/10 rounded-3xl flex items-center justify-center text-2xl font-bold text-white border-2 border-dashed border-white/20">LOGO X</div>
           <div className="aspect-square bg-white/10 rounded-3xl flex items-center justify-center text-2xl font-bold text-white border-2 border-dashed border-white/20">LOGO Y</div>
        </div>

        <motion.p 
           initial={{ opacity: 0 }}
           whileInView={{ opacity: 1 }}
           className="text-white text-xl md:text-2xl font-medium"
        >
          all’interno di Cersaie, a Bologna Fiere, <br/>
          dal 21 al 25 settembre 2026
        </motion.p>
      </div>
    </SectionContainer>
  )
}
