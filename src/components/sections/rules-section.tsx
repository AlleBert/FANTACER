'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionContainer } from '../layout/section-container'
import { Heart, MessageCircle, Smartphone, Gift } from 'lucide-react'

const steps = [
  { icon: Heart, text: 'vota la tua azienda preferita', color: 'bg-white' },
  { icon: MessageCircle, text: 'rispondi a 3 domande sul suo stand', color: 'bg-white' },
  { icon: Smartphone, text: 'condividi il tuo voto taggando @fantacer', color: 'bg-white' },
  { icon: Gift, text: 'ritira il tuo premio', color: 'bg-white' }
]

export function RulesSection() {
  return (
    <SectionContainer className="bg-gradient-to-b from-[#FF00FF] to-[#FF8C00]" id="rules-section">
      <div className="flex flex-col items-center gap-12 w-full">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-4xl md:text-7xl font-black text-white text-center leading-none"
        >
          è semplice... <br/>e si vince sempre!
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center gap-4 bg-white/20 backdrop-blur-md p-8 rounded-[40px] border-4 border-white/30 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-magenta-600 shadow-xl">
                <step.icon size={48} strokeWidth={2.5} />
              </div>
              <p className="text-xl md:text-2xl font-black text-white leading-tight uppercase">
                {step.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionContainer>
  )
}
