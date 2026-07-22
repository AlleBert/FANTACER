'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Company {
  id: string
  name: string
  category?: string
  image_url?: string
  position?: number
}

interface CompanyCardProps {
  company: Company
  onVote: (id: string) => void
  disabled?: boolean
  loading?: boolean
}

export function CompanyCard({ company, onVote, disabled, loading }: CompanyCardProps) {
  const isTop = company.position && company.position <= 3
  
  return (
    <Card className={`
      relative overflow-hidden transition-all duration-300
      rounded-[32px] border-4 border-[#6B21A8]/10 group
      bg-white hover:border-magenta-500 hover:-translate-y-2
      ${isTop ? 'shadow-[0_12px_0_rgba(107,33,168,0.1)] ring-2 ring-[#6B21A8]/20' : 'shadow-[0_8px_0_rgba(0,0,0,0.05)]'}
    `}>
      <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden p-6">
        {company.image_url ? (
          <img 
            src={company.image_url} 
            alt={company.name}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="text-5xl font-black text-[#6B21A8]/20 italic">
            {company.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        {company.position && company.position <= 10 && (
          <div className={`
            absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center font-black text-white
            shadow-xl border-2 border-white
            ${company.position === 1 ? 'bg-yellow-400' : 
              company.position === 2 ? 'bg-gray-300' : 
              company.position === 3 ? 'bg-orange-400' : 'bg-[#6B21A8]'}
          `}>
            {company.position}
          </div>
        )}
      </div>
      
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="text-center">
          <h3 className="font-black text-xl md:text-2xl uppercase italic text-[#6B21A8] leading-tight truncate">
            {company.name}
          </h3>
        </div>
        <Button 
          onClick={() => onVote(company.id)}
          disabled={disabled || loading}
          className="w-full h-14 rounded-full bg-magenta-500 hover:bg-magenta-600 text-white font-black text-xl uppercase italic shadow-[0_6px_0_rgb(192,38,211)] active:translate-y-1 active:shadow-none transition-all"
        >
          {loading ? 'Votando...' : 'Vota'}
        </Button>
      </CardContent>
    </Card>
  )
}