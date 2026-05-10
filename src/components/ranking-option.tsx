'use client'


interface RankingOptionProps {
  label: string
  isSelected?: boolean
  onClick?: () => void
}

export function RankingOption({ label, isSelected, onClick }: RankingOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center p-4 md:p-6 rounded-[1.5rem] transition-all duration-300 w-full text-center border-[3px] ${
        isSelected 
          ? 'bg-[#ff8a26] border-black shadow-[8px_8px_0_#000] -translate-y-1.5' 
          : 'bg-white border-black shadow-[3px_3px_0_#000] hover:shadow-[8px_8px_0_#000] hover:-translate-y-1.5'
      }`}
    >
      <span className={`text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-[#8000ff]'}`}>
        {label}
      </span>
    </button>
  )
}