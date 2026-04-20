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
    <Card className={`overflow-hidden ${isTop ? 'border-yellow-400 border-2' : ''}`}>
      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative">
        {company.image_url ? (
          <img 
            src={company.image_url} 
            alt={company.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-4xl font-bold text-muted-foreground/30">
            {company.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        {company.position && (
          <div className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white
            ${company.position === 1 ? 'bg-yellow-500' : 
              company.position === 2 ? 'bg-gray-400' : 
              'bg-amber-700'}`}
          >
            {company.position}
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold truncate mb-1">{company.name}</h3>
        {company.category && (
          <p className="text-xs text-muted-foreground mb-3">{company.category}</p>
        )}
        <Button 
          onClick={() => onVote(company.id)}
          disabled={disabled || loading}
          className="w-full"
          size="sm"
        >
          {loading ? 'Votando...' : 'Vota'}
        </Button>
      </CardContent>
    </Card>
  )
}