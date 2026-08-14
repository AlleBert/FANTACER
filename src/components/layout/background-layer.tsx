'use client'

import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'

interface BackgroundLayerProps {
  theme: SectionThemeKey | null
}

/**
 * Sole owner of the section background.
 *
 * Two crossfading layers (previous/current theme) driven by `AnimatePresence`:
 * when the active section changes, the outgoing gradient fades out over the
 * incoming one. No `transition: background` on a single element — gradients are
 * not reliably interpolable, opacity layering is.
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
  if (!theme) return null

  return (
    <MotionConfig reducedMotion="user">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <AnimatePresence>
          <motion.div
            key={theme}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ background: sectionThemes[theme].background }}
          />
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
