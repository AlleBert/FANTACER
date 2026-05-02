'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'
import { Mail } from 'lucide-react'

export function ContactSection() {
  return (
    <SectionContainer className="bg-gradient-to-b from-[#FF00FF] to-[#FF8C00]" id="contact-section">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
        {/* 3D Envelope Mockup Placeholder */}
        <motion.div 
           initial={{ rotate: -10, scale: 0.8 }}
           whileInView={{ rotate: 0, scale: 1 }}
           className="relative aspect-square bg-white/20 rounded-[60px] flex items-center justify-center border-4 border-white/30 backdrop-blur-xl shadow-2xl"
        >
          <Mail size={160} className="text-white" />
        </motion.div>

        <div className="flex flex-col gap-8 text-white">
          <motion.h2 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="text-5xl md:text-8xl font-black italic"
          >
            Parla con noi
          </motion.h2>

          <div className="flex flex-col gap-4 text-2xl md:text-4xl font-bold">
            <p>fantacer@fantacer.com</p>
            <p>00 000 000</p>
            <p>www.fantacer.com</p>
          </div>
        </div>
      </div>
    </SectionContainer>
  )
}
