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
      className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
        isSelected ? 'bg-mockup-blue' : 'hover:bg-gray-100'
      }`}
    >
      <Image
        src="/Mask-Group2.svg"
        alt=""
        width={45}
        height={42}
        className="w-10 h-10"
      />
      <span className={`text-2xl md:text-3xl font-bold text-mockup-purple ${isSelected ? 'opacity-100' : ''}`}>
        {label}
      </span>
    </button>
  )
}