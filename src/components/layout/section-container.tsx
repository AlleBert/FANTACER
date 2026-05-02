import React from 'react'
import { cn } from '@/lib/utils'

interface SectionContainerProps {
  children: React.ReactNode
  className?: string
  id?: string
  fullHeight?: boolean
}

export function SectionContainer({ children, className, id, fullHeight = true }: SectionContainerProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full overflow-hidden flex flex-col items-center justify-center px-4 py-16",
        fullHeight && "min-h-screen",
        className
      )}
    >
      <div className="w-full max-w-7xl mx-auto z-10">
        {children}
      </div>
    </section>
  )
}
