'use client'

import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'

interface BackgroundLayerProps {
  theme: SectionThemeKey | null
}

/**
 * Sole owner of the section background.
 *
 * `position: fixed; inset: 0` keeps the gradient at viewport level, edge-to-edge
 * behind notch and home indicator (viewport-fit=cover), independently of the
 * scrollable `main` container and of the AppShell wrapper height — including
 * during iOS rubber-band/overscroll where the scrollable content bounces.
 *
 * No safe-area padding here: the background must reach the physical edges.
 * Content is safe-area aware via the existing `.safe-*` system.
 */
export function BackgroundLayer({ theme }: BackgroundLayerProps) {
  const background = theme ? sectionThemes[theme].background : undefined
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background }}
    />
  )
}
