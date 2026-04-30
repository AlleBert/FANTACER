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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-accent" />
        <h2 className="font-semibold text-lg">Top {limit}</h2>
      </div>
      
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <motion.div 
            key={item.id} 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              flex items-center justify-between p-3 rounded-lg transition-colors duration-200
              ${index === 0 ? 'bg-secondary' : 'bg-transparent'}
            `}
          >
            <div className="flex items-center gap-3">
              <span className={`
                w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-sm
                ${index === 0 ? 'bg-yellow-500' : 
                  index === 1 ? 'bg-gray-400' : 
                  'bg-amber-700'}
              `}>
                {index + 1}
              </span>
              <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">
                {item.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-bold text-accent">{item.votes}</span>
              {item.trend !== undefined && (
                <span className={`
                  flex items-center text-xs
                  ${item.trend > 0 ? 'text-green-500' : 
                    item.trend < 0 ? 'text-red-500' : 
                    'text-muted-foreground'}
                `}>
                  {item.trend > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : item.trend < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {Math.abs(item.trend)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}