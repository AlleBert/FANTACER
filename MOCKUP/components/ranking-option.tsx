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
      className={`flex items-center gap-4 p-4 rounded-lg transition-all w-full text-left ${
        isSelected ? 'bg-[#c2e1ff]' : 'hover:bg-gray-100'
      }`}
    >
      <Image
        src="/Mask-Group2.svg"
        alt=""
        width={45}
        height={42}
        className="w-10 h-10 flex-shrink-0"
      />
      <span className="text-xl md:text-2xl lg:text-3xl font-bold text-[#8000ff]">
        {label}
      </span>
    </button>
  )
}