'use client'

import Image from 'next/image'

interface RankingOptionProps {
  label: string
  isSelected?: boolean
  onClick?: () => void
}

export function RankingOption({ label, isSelected, onClick }: RankingOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl transition-all w-full text-left border-2 ${
        isSelected ? 'bg-[#ff8a26] border-black shadow-[2px_2px_0_#000]' : 'bg-white border-transparent hover:border-gray-200'
      }`}
    >
      <div className="relative w-12 h-12 flex-shrink-0">
        <Image
          src="/ranking-icon.svg"
          alt=""
          fill
          className="object-contain"
        />
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center -top-2 -right-2">
             <span className="text-4xl text-black font-black drop-shadow-[1px_1px_0_white]">✓</span>
          </div>
        )}
      </div>
      <span className={`text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-[#8000ff]'}`}>
        {label}
      </span>
    </button>
  )
}