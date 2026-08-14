'use client'

import { useRef, type ReactNode } from 'react'
import { BackgroundLayer } from '@/components/layout/background-layer'
import { BrowserThemeColor } from '@/components/layout/browser-theme-color'
import { useActiveSection } from '@/lib/use-active-section'

/**
 * Public fullscreen shell.
 *
 * Owns the viewport, the scroll container and the active-section state that
 * drives the BackgroundLayer. Renders `main` as the exact scroll container the
 * responsive/visual audits depend on (`main > section`), with explicit layering:
 *
 *   BackgroundLayer     → position: fixed, z-0, pointer-events-none
 *   BrowserThemeColor   → keeps meta theme-color in sync with active section
 *   main                → relative, z-10 (scroll container)
 */
export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null)
  const active = useActiveSection(mainRef)

  return (
    <div className="relative" style={{ height: 'var(--app-height)' }}>
      <BackgroundLayer theme={active} />
      <BrowserThemeColor theme={active} />
      <main
        ref={mainRef}
        className="relative z-10 overflow-y-auto scroll-smooth no-scrollbar snap-y snap-mandatory"
        style={{ height: 'var(--app-height)' }}
      >
        {children}
      </main>
    </div>
  )
}
