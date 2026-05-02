'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 px-4">
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <Button
          onClick={onPlayClick}
          className="bg-mockup-blue hover:bg-[#a8c7e6] text-black text-2xl md:text-3xl font-bold px-12 py-8 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors mb-8"
        >
          GIOCA
        </Button>
        
        <p className="text-lg md:text-xl text-gray-700 font-medium">
          puoi giocare una sola volta al giorno
          <br />
          dal 21 al 25 settembre 2026
        </p>
      </div>
      
      <Image
        src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
        alt=""
        width={134}
        height={132}
        className="absolute left-8 top-1/2 w-24 h-24 -translate-y-1/2 object-contain"
      />
    </section>
  )
}