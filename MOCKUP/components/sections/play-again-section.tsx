'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface PlayAgainSectionProps {
  onPlayClick?: () => void
}

export function PlayAgainSection({ onPlayClick }: PlayAgainSectionProps) {
  return (
    <section className="relative w-full bg-white py-16 md:py-24 lg:py-32">
      {/* Background Frame */}
      <Image
        src="/Frame.svg"
        alt=""
        fill
        className="absolute inset-0 object-cover pointer-events-none"
        aria-hidden="true"
      />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
        {/* GIOCA Button */}
        <Button
          onClick={onPlayClick}
          className="bg-[#c2e1ff] hover:bg-[#a8c7e6] text-black text-2xl md:text-3xl font-bold px-12 md:px-20 py-8 rounded-full border-2 border-[#231f20] hover:border-[#575254] transition-colors mb-8"
        >
          GIOCA
        </Button>
        
        <p className="text-base md:text-lg lg:text-xl text-gray-700 font-medium">
          puoi giocare una sola volta al giorno
          <br />
          <span className="font-bold">dal 21 al 25 settembre 2026</span>
        </p>
      </div>
      
      {/* Decorative images - left side */}
      <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 hidden md:flex gap-2">
        <Image
          src="/66575995e12c5eb39d73e52b4f11e549-png1@2x.png"
          alt=""
          width={134}
          height={132}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
        <Image
          src="/840edc06-e826-44c6-bba4-2b5d4e2b5b7f@2x.png"
          alt=""
          width={130}
          height={127}
          className="w-20 h-20 lg:w-24 lg:h-24 object-contain"
        />
      </div>
    </section>
  )
}