'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'

export function IntroSection() {
  return (
    <SectionContainer className="bg-[#6B21A8]" id="intro-section">
      <div className="max-w-4xl text-center flex flex-col gap-8">
        <motion.h2 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-7xl font-black text-white leading-tight italic"
        >
          il primo gioco semiserio del distretto ceramico...
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-2xl md:text-4xl font-bold text-magenta-500"
        >
          usa il cellulare per qualcosa di davvero importante!
        </motion.p>
      </div>
    </SectionContainer>
  )
}
