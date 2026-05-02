'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  const scrollToVoting = () => {
    const el = document.getElementById('search-section')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <SectionContainer 
      className="bg-[#FF00FF] bg-[url('/BACKGROUND.png')] bg-cover bg-center"
      id="hero-section"
    >
      {/* Fallback gradient if background image fails */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF00FF] via-[#6B21A8] to-[#FF8C00] opacity-40 mix-blend-overlay" />
      
      <div className="flex flex-col items-center gap-12 text-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8 }}
        >
          {/* Logo Placeholder - assuming Logo is in the image or text-styled */}
          <h1 className="text-6xl md:text-9xl font-bold text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)] tracking-tighter italic">
            FANTACER
          </h1>
          <p className="text-xl md:text-3xl font-semibold text-yellow-300 mt-4 tracking-wider uppercase">
            Play to Win
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Button 
            onClick={scrollToVoting}
            className="bg-yellow-400 hover:bg-yellow-300 text-black text-2xl md:text-5xl font-black px-12 py-8 md:px-20 md:py-14 rounded-full shadow-[0_10px_0_rgb(202,138,4)] active:translate-y-1 active:shadow-none transition-all uppercase tracking-widest"
          >
            GIOCA
          </Button>
        </motion.div>
      </div>
    </SectionContainer>
  )
}
