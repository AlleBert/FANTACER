'use client'

import { useState, useEffect } from 'react'
import { Search, Trophy, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  onSearch: (query: string) => void
  hasVoted: boolean
}

export function Header({ onSearch, hasVoted }: HeaderProps) {
  const [searchValue, setSearchValue] = useState('')
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft(`${hours}h ${minutes}m`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-xl border-b border-black/5 dark:border-white/10 shadow-sm pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-accent" />
          <span className="font-bold text-xl tracking-tight">FANTACER</span>
        </div>
        
        {hasVoted && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
            <Clock className="h-3 w-3" />
            <span>Resetta {timeLeft}</span>
          </div>
        )}
      </div>
      
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value)
              onSearch(e.target.value)
            }}
            className="pl-9 bg-secondary/80 border-transparent focus:border-accent rounded-full transition-all duration-300 focus:bg-background shadow-inner"
          />
        </div>
      </div>
    </header>
  )
}