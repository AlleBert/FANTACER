'use client'

import type { BatchItem } from '@/hooks/use-batches'
import { cn } from '@/lib/utils'

interface BatchFilterProps {
  batches: BatchItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Selettore batch condiviso dalle pagine admin. `value` è il nome del batch
 * attivo oppure `'all'` per "Tutti i batch".
 */
export function BatchFilter({ batches, value, onChange, className }: BatchFilterProps) {
  const options = [{ name: 'all', label: 'Tutti' }, ...batches.map((b) => ({ name: b.name, label: b.name }))]

  return (
    <div className={cn('flex gap-1 flex-wrap', className)}>
      {options.map((opt) => (
        <button
          key={opt.name}
          type="button"
          onClick={() => onChange(opt.name)}
          className={cn(
            'px-3 py-2 text-[clamp(0.75rem,2vw,0.875rem)] rounded-full transition-colors',
            value === opt.name
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
