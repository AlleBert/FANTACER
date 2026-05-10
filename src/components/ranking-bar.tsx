'use client'

import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion } from 'framer-motion'

interface RankingItem {
  id: string
  name: string
  votes: number
  trend?: number
}

interface RankingBarProps {
  ranking: RankingItem[]
  limit?: number
}

export function RankingBar({ ranking, limit = 3 }: RankingBarProps) {
  const displayItems = ranking.slice(0, limit)
  
  if (ranking.length === 0) {
    return null
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <div className="flex items-center gap-4 mb-6">
        <Trophy className="h-8 w-8 text-[#FF8C00]" />
        <h2 className="font-black text-4xl italic uppercase text-[#6B21A8]">Top {limit}</h2>
      </div>
      
      <div className="flex flex-col gap-4">
        {displayItems.map((item, index) => (
          <motion.div 
            key={item.id} 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className={`
              flex items-center justify-between p-6 rounded-[32px] border-4 transition-all duration-300
              ${index === 0 ? 'bg-yellow-400 border-yellow-500 shadow-[0_8px_0_rgb(202,138,4)]' : 
                index === 1 ? 'bg-gray-100 border-gray-200 shadow-[0_8px_0_rgb(209,213,219)]' : 
                'bg-orange-100 border-orange-200 shadow-[0_8px_0_rgb(253,186,116)]'}
            `}
          >
            <div className="flex items-center gap-6">
              <span className={`
                w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl shadow-inner
                ${index === 0 ? 'bg-white text-yellow-600' : 
                  index === 1 ? 'bg-white text-gray-500' : 
                  'bg-white text-orange-600'}
              `}>
                {index + 1}
              </span>
              <span className="font-black text-2xl md:text-3xl uppercase italic text-gray-900 truncate">
                {item.name}
              </span>
            </div>
            
            <div className="flex items-center gap-3 bg-white/50 px-6 py-2 rounded-full border-2 border-white/80">
              <span className="font-black text-2xl text-[#6B21A8]">{item.votes}</span>
              <span className="text-xs font-bold uppercase text-[#6B21A8]/60">Voti</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}