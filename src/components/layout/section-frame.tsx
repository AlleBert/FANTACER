'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { SectionThemeKey } from '@/lib/section-themes'

interface SectionFrameProps {
  theme: SectionThemeKey
  id?: string
  /** grow → `snap-start app-screen` (content can exceed viewport, e.g. SearchSection) */
  grow?: boolean
  className?: string
  children: ReactNode
}

/**
 * Renders the `<section>` element itself (no extra wrapper) so the required
 * `main > section` structure and `main > section:nth-child(n)` selectors used by
 * the responsive/visual audits stay valid. `data-section={theme}` is the stable
 * identifier read by `useActiveSection`. The background is NOT applied here:
 * it belongs to `BackgroundLayer`.
 */
export function SectionFrame({ theme, id, grow = false, className, children }: SectionFrameProps) {
  return (
    <section
      data-section={theme}
      id={id}
      className={cn(
        'relative w-full overflow-hidden',
        grow ? 'snap-start app-screen' : 'snap-screen',
        className,
      )}
    >
      {children}
    </section>
  )
}
