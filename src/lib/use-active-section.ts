'use client'

import { useEffect, useState, type RefObject } from 'react'
import { sectionThemes, type SectionThemeKey } from '@/lib/section-themes'

/**
 * Returns the section currently dominating the viewport of `rootRef` (the `main`
 * scroll container). Uses a single IntersectionObserver on `rootRef` children that
 * carry `data-section`; the active theme is the section with the highest
 * intersection ratio.
 *
 * A single MutationObserver re-establishes the IntersectionObserver when sections
 * are added/removed dynamically (e.g. the conditional `SuccessSection`), so a
 * newly mounted `data-section="success"` is picked up. Both observers are fully
 * cleaned up on unmount; no observer is ever left duplicated.
 */
export function useActiveSection(rootRef: RefObject<HTMLElement | null>): SectionThemeKey | null {
  const [active, setActive] = useState<SectionThemeKey | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ratios = new Map<string, number>()
    const keys = Object.keys(sectionThemes) as SectionThemeKey[]
    keys.forEach((key) => ratios.set(key, 0))

    let io: IntersectionObserver | null = null
    let mo: MutationObserver | null = null

    const pickActive = () => {
      let best: SectionThemeKey | null = null
      let max = 0
      ratios.forEach((ratio, key) => {
        if (ratio > max) {
          max = ratio
          best = key as SectionThemeKey
        }
      })
      setActive(best)
    }

    const observe = () => {
      if (io) io.disconnect()
      const sections = Array.from(root.querySelectorAll<HTMLElement>('section[data-section]'))
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const key = entry.target.getAttribute('data-section')
            if (key && ratios.has(key)) {
              ratios.set(key, entry.isIntersecting ? entry.intersectionRatio : 0)
            }
          }
          pickActive()
        },
        { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
      )
      sections.forEach((section) => io?.observe(section))
    }

    observe()

    mo = new MutationObserver(observe)
    mo.observe(root, { childList: true })

    return () => {
      io?.disconnect()
      io = null
      mo?.disconnect()
      mo = null
    }
  }, [rootRef])

  return active
}
