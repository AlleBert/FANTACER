'use client'

import type { ReactNode } from 'react'
import { SectionFrame } from '@/components/layout/section-frame'
import { SiteFooter } from '@/components/layout/site-footer'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/LocaleContext'
import { sectionThemes } from '@/lib/section-themes'

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

const pillLink =
  'toc-pill block w-full px-3 py-2 text-xs font-black uppercase tracking-wider text-ink/70 border-2 border-ink/20 rounded-full hover:border-ink hover:bg-ink/5 hover:text-ink transition-all duration-150'

const summaryColors = {
  yellow: 'bg-bright/20 border-bright',
  blue: 'bg-question-blue/30 border-question-blue',
  green: 'bg-green-100 border-green-400',
}

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

  return (
    <SectionFrame theme="legal" grow className={cn('flex flex-col', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: sectionThemes.legal.background }}
      />

      <div className="safe-shell content-max relative z-10 flex flex-1 flex-col min-h-0">
        <div className="flex-1 flex w-full flex-col lg:flex-row min-h-0 overflow-y-auto py-(--section-pad) lg:py-[clamp(2rem,4vw,4rem)]">
          {toc.length > 0 && (
            <aside
              className="hidden lg:block lg:w-[220px] lg:flex-shrink-0 lg:sticky lg:top-[calc(var(--section-pad)+1rem)] lg:self-start lg:max-h-[calc(100dvh-var(--section-pad)*2)] lg:overflow-y-auto lg:pr-4"
              aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}
            >
              <nav className="space-y-2">
                <p className="mb-3 w-fit rounded-full border-2 border-ink/20 bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink shadow-[2px_2px_0_#000]">
                  {locale === 'it' ? 'In questa pagina' : 'On this page'}
                </p>
                <ul className="space-y-1.5" role="list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className={pillLink}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {toc.length > 0 && (
            <details className="group lg:hidden mb-4" aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}>
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-2 rounded-full border-2 border-ink/20 bg-white/90 px-4 py-3 text-left text-sm font-black uppercase tracking-wider text-ink shadow-[4px_4px_0_#000] backdrop-blur-sm transition-all duration-150 hover:border-ink hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000]">
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
                        className={pillLink}
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
              'prose-legal w-full',
              'flex-1 bg-white px-(--space-md) sm:px-(--space-lg) pb-(--section-pad)',
              'lg:mx-auto lg:max-w-(--measure-wide) lg:rounded-[2.25rem] lg:border-[3px] lg:border-ink lg:bg-white lg:p-[clamp(1rem,min(3vw,4svh),2.5rem)] lg:pb-(--section-pad)',
            )}
            id="legal-content"
          >
            <header className="mb-[clamp(1.5rem,3vw,2.5rem)] pb-[clamp(1rem,2vw,1.5rem)] border-b-[3px] border-ink">
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

            <div className={cn('mb-6 rounded-2xl border-2 p-4 sm:p-6', summaryColors[summaryColor])}>
              {summaryBox}
            </div>

            {children}
          </article>
        </div>

        <SiteFooter />
      </div>
    </SectionFrame>
  )
}
