'use client'

import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

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
    <div className="bg-muted/50 p-4 rounded-lg mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h2 className="font-semibold">Top {limit}</h2>
      </div>
      
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <div 
            key={item.id} 
            className="flex items-center justify-between bg-background p-3 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white
                ${index === 0 ? 'bg-yellow-500' : 
                  index === 1 ? 'bg-gray-400' : 
                  'bg-amber-700'}`}
              >
                {index + 1}
              </span>
              <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">
                {item.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-bold">{item.votes}</span>
              {item.trend !== undefined && (
                <span className={`flex items-center text-xs
                  ${item.trend > 0 ? 'text-green-500' : 
                    item.trend < 0 ? 'text-red-500' : 
                    'text-muted-foreground'}`}
                >
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
          </div>
        ))}
      </div>
    </div>
  )
}