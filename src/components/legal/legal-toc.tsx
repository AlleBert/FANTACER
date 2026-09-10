'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface LegalTocItem {
  id: string
  label: string
}

export function LegalToc({ items, label }: { items: LegalTocItem[]; label: string }) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return

    setActiveId(id)
    const offset = 96
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-25% 0px -70% 0px', threshold: [0, 0.1, 0.5] },
    )
    for (const el of els) io.observe(el)

    const onScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom && items.length > 0) setActiveId(items[items.length - 1].id)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [items])

  return (
    <aside
      className="hidden w-[200px] flex-shrink-0 lg:sticky lg:top-24 lg:block lg:self-start"
      aria-label={label}
    >
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-ink/50">
        {label}
      </p>
      <ul className="border-l border-ink/10">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={activeId === item.id ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault()
                scrollToSection(item.id)
              }}
              className={cn(
                '-ml-px block border-l-2 py-1.5 pl-3 text-[13px] leading-snug text-ink/60 transition-colors hover:text-ink',
                activeId === item.id
                  ? 'is-scrollspy-active border-purple font-bold text-ink'
                  : 'border-transparent',
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
