'use client'

import { useRef, type FocusEvent, type ReactNode } from 'react'
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
const isTextField = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA'
}

export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null)
  const active = useActiveSection(mainRef)

  // Con un campo focalizzato lo snap del container viene disattivato via CSS
  // (`main[data-input-focused='true']`): su Android la tastiera scrolla il
  // campo in vista e lo snap mandatory lo riaggancerebbe, nascondendolo.
  const handleFocusCapture = (e: FocusEvent<HTMLElement>) => {
    if (!isTextField(e.target)) return
    const main = mainRef.current
    if (!main) return
    main.dataset.inputFocused = 'true'
    main.scrollLeft = 0
  }

  const handleBlurCapture = (e: FocusEvent<HTMLElement>) => {
    if (!isTextField(e.target)) return
    const main = mainRef.current
    if (!main) return
    delete main.dataset.inputFocused
    main.scrollLeft = 0
  }

  return (
    <div className="relative" style={{ height: 'var(--app-height)' }}>
      <BackgroundLayer theme={active} />
      <BrowserThemeColor theme={active} />
      <main
        ref={mainRef}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        className="relative z-10 overflow-y-auto overflow-x-hidden overscroll-x-none scroll-smooth no-scrollbar snap-y snap-mandatory"
        style={{ height: 'var(--app-height)' }}
      >
        {children}
      </main>
    </div>
  )
}
