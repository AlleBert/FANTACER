'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { SectionFrame } from '@/components/layout/section-frame'
import { SiteFooter } from '@/components/layout/site-footer'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/LocaleContext'

import type { DictionaryKey } from '@/i18n/dictionary'

interface LegalPageLayoutProps {
  children: ReactNode
  summaryBox: ReactNode
  summaryColor?: 'yellow' | 'blue' | 'green'
  className?: string
  toc?: Array<{ id: string; label: string }>
  titleKey: DictionaryKey
  lastUpdatedKey?: DictionaryKey
}

const summaryBands = {
  yellow: { bg: 'bg-bright/20', border: 'border-bright' },
  blue: { bg: 'bg-question-blue/15', border: 'border-question-blue' },
  green: { bg: 'bg-green-100', border: 'border-green-400' },
}

/**
 * Layout pagine legali — design "Clean Document":
 * - Superficie velatura brand tenue (nessuna card galleggiante su gradiente)
 * - Scroll sulla finestra (niente contenitore overflow-y-auto interno)
 * - Header sticky con wordmark + bottone "torna al gioco" (HOME)
 * - TOC desktop sticky con scrollspy; accordion pulito su mobile
 * - Article bianco full-bleed; footer light con sole 3 legal pages
 */
export function LegalPageLayout({
  children,
  summaryBox,
  summaryColor = 'yellow',
  className,
  toc = [],
  titleKey,
  lastUpdatedKey = 'cookiePolicy.lastUpdated',
}: LegalPageLayoutProps) {
  const { t, locale } = useLocale()
  const today = new Date()
  const formattedDate = today.toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const sections = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    for (const s of sections) io.observe(s)
    return () => io.disconnect()
  }, [toc])

  return (
    <SectionFrame theme="legal" grow clip className={cn('legal-surface flex flex-col', className)}>
      <header className="safe-px sticky top-0 z-20 border-b-2 border-ink/10 bg-[color-mix(in_srgb,var(--background)_85%,transparent)] pt-(--safe-top) backdrop-blur-sm">
        <div className="content-max mx-auto flex items-center justify-between gap-4 pb-3">
          <span className="text-lg font-black lowercase tracking-tighter text-ink">
            fantacer<span className="text-orange">★</span>
          </span>
          <a
            href="/"
            className="inline-flex items-center rounded-full border-2 border-ink bg-ink px-4 py-2 text-xs font-black uppercase tracking-wider text-bright shadow-[2px_2px_0_#000] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#000]"
          >
            {t('legal.backToGame')}
          </a>
        </div>
      </header>

      <div className="content-max safe-px mx-auto w-full flex-1 py-(--section-pad) lg:py-[clamp(2rem,4vw,4rem)]">
        <div className="flex w-full flex-col gap-6 lg:flex-row">
          {toc.length > 0 && (
            <aside
              className="hidden w-[220px] flex-shrink-0 lg:sticky lg:top-24 lg:block lg:self-start"
              aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}
            >
              <nav className="space-y-2">
                <p className="mb-3 w-fit rounded-full border-2 border-ink/20 bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink">
                  {locale === 'it' ? 'In questa pagina' : 'On this page'}
                </p>
                <ul className="space-y-1.5" role="list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={cn('toc-pill', activeId === item.id && 'is-active')}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {toc.length > 0 && (
            <details className="group lg:hidden" aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}>
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-2 rounded-full border-2 border-ink/20 bg-white/90 px-4 py-3 text-left text-sm font-black uppercase tracking-wider text-ink transition-all duration-150 hover:border-ink">
                {locale === 'it' ? 'Indice' : 'Contents'}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 transition-transform duration-150 group-open:rotate-180"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <nav className="mt-3 space-y-2 px-1" aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}>
                <ul className="space-y-1.5" role="list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="toc-pill"
                        onClick={(e) => {
                          const details = e.currentTarget.closest('details')
                          details?.removeAttribute('open')
                        }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}

          <article
            className={cn(
              'prose-legal w-full flex-1 bg-white px-(--space-md) sm:px-(--space-lg) pb-(--section-pad)',
              'lg:mx-auto lg:max-w-(--measure-wide)',
            )}
            id="legal-content"
          >
            <header className="mb-[clamp(1.5rem,3vw,2.5rem)] pb-[clamp(1rem,2vw,1.5rem)] border-b-2 border-ink/10">
              <span className="mb-4 inline-block rounded-full border-2 border-ink bg-bright px-4 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0_#000]">
                FANTACER · {locale === 'it' ? 'Info legali' : 'Legal info'}
              </span>
              <h1 className="text-(length:--fs-headline-tight) font-black lowercase tracking-tighter text-ink leading-(--lh-headline) text-balance">
                {t(titleKey)}
              </h1>
              <p className="mt-3 text-xs font-black lowercase tracking-wider text-ink/70">
                {t(lastUpdatedKey, { date: formattedDate })}
              </p>
            </header>

            <div className={cn('summary-band mb-8', summaryBands[summaryColor].bg, summaryBands[summaryColor].border)}>
              {summaryBox}
            </div>

            {children}
          </article>
        </div>
      </div>

      <SiteFooter variant="light" showCookieButton={false} />
    </SectionFrame>
  )
}