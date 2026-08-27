'use client'

import { useEffect, useState } from 'react'
import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'

interface BackgroundLayerProps {
  theme: SectionThemeKey | null
}

/**
 * Sole owner of the section background.
 *
 * Two-layer crossfade driven by CSS only. When the active section changes:
 * the OLD theme stays mounted behind at full opacity (it was already opaque),
 * while the NEW theme mounts ON TOP with a CSS `background-fade-in` animation
 * (opacity 0 → 1, 0.5s). Once the animation is over (520ms), the old layer is
 * removed. No `transition: background` on a single element — gradients are not
 * reliably interpolable, opacity layering is.
 *
 * `position: fixed; inset: 0` keeps the gradient at viewport level, edge-to-edge
 * behind notch and home indicator (viewport-fit=cover), independently of the
 * scrollable `main` container and of the AppShell wrapper height — including
 * during iOS rubber-band/overscroll where the scrollable content bounces.
 *
 * No safe-area padding here: the background must reach the physical edges.
 * Content is safe-area aware via the existing `.safe-*` system.
 *
 * Reduced-animation preference: `prefers-reduced-motion: reduce` disables the
 * fade-in in `globals.css` (`.background-fade-in`), keeping the new background
 * instant.
 */
export function BackgroundLayer({ theme }: BackgroundLayerProps) {
  // `old` holds the theme that stays behind during the fade-in of the new one.
  // The current layer is derived directly from the `theme` prop.
  const [old, setOld] = useState<SectionThemeKey | null>(null)
  const [prevTheme, setPrevTheme] = useState<SectionThemeKey | null>(theme)

  // Adjust state during render (React-documented "derived from props" pattern):
  // when `theme` changes, the previous theme becomes the layer behind the
  // incoming one. No effect needed for the transition itself.
  if (theme && prevTheme !== theme) {
    setPrevTheme(theme)
    setOld(prevTheme)
  }

  // Drop the old layer once the fade-in animation is over. setState only in the
  // async callback — never synchronously in the effect body.
  useEffect(() => {
    if (!old) return
    const timeout = window.setTimeout(() => setOld(null), 520)
    return () => window.clearTimeout(timeout)
  }, [old])

  if (!theme && !old) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      {old && (
        <div
          className="absolute inset-0"
          style={{ background: sectionThemes[old].background }}
        />
      )}
      <div
        className="absolute inset-0 background-fade-in"
        style={{ background: sectionThemes[(theme ?? old) as SectionThemeKey].background }}
      />
    </div>
  )
}