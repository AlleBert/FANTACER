'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CtaButtonProps {
  onClick?: () => void
  className?: string
  /** scala extra (play-again usa 1.15) */
  scale?: number
  children: React.ReactNode
}

export function CtaButton({ onClick, className, scale = 1, children }: CtaButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        'bg-bright hover:bg-[#c99900] text-black font-black uppercase tracking-tighter rounded-full border-[3px] md:border-[4px] border-black shadow-[6px_6px_0_#000] transition-transform hover:scale-105 active:scale-95 cursor-pointer h-auto',
        'px-[calc(var(--cta-pad-x)*var(--cta-scale))] py-[calc(var(--cta-pad-y)*var(--cta-scale))]',
        'text-[calc(var(--fs-cta)*var(--cta-scale))]',
        className,
      )}
      style={{ '--cta-scale': String(scale) } as React.CSSProperties}
    >
      {children}
    </Button>
  )
}
