'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

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
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Card className={`
        overflow-hidden transition-all duration-200
        border border-gray-300 dark:border-gray-700
        ${isTop ? 'border-orange-500 shadow-lg' : 'hover:border-orange-500 hover:shadow-lg'}
      `}>
      <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
        {company.image_url ? (
          <img 
            src={company.image_url} 
            alt={company.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="text-4xl font-bold text-gray-400">
            {company.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        {company.position && company.position <= 3 && (
          <div className={`
            absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white
            shadow-lg
            ${company.position === 1 ? 'bg-yellow-500 shadow-yellow-500/30' : 
              company.position === 2 ? 'bg-gray-400 shadow-gray-400/30' : 
              'bg-amber-700 shadow-amber-700/30'}
          `}>
            {company.position}
          </div>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold truncate text-gray-900 dark:text-white">{company.name}</h3>
          {company.category && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{company.category}</p>
          )}
        </div>
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
    </motion.div>
  )
}