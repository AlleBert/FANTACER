'use client'

import { useEffect } from 'react'
import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'

interface BrowserThemeColorProps {
  theme: SectionThemeKey | null
}

const THEME_COLOR_SELECTOR = 'meta[name="theme-color"]'

/**
 * Keeps `<meta name="theme-color">` in sync with the active section theme.
 *
 * Separate responsibility from BackgroundLayer: while the layer owns the page
 * background gradient, this component owns the browser chrome color (iOS status
 * bar / Android toolbar). It consumes the same `activeSection` state that
 * drives BackgroundLayer — no second IntersectionObserver.
 *
 * The meta tag is updated only when `theme` changes (never on every scroll
 * frame). `themeColor` is the solid color at the top of the section gradient,
 * so the status bar visually blends with the section top edge. iOS only accepts
 * a single color here, not a gradient.
 */
export function BrowserThemeColor({ theme }: BrowserThemeColorProps) {
  useEffect(() => {
    if (!theme) return
    let meta = document.querySelector<HTMLMetaElement>(THEME_COLOR_SELECTOR)
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.content = sectionThemes[theme].themeColor
  }, [theme])

  return null
}
