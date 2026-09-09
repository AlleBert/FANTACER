'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { SectionFrame } from '@/components/layout/section-frame'
import { SiteFooter } from '@/components/layout/site-footer'
import { LegalToc, type LegalTocItem } from '@/components/legal/legal-toc'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/LocaleContext'

import type { DictionaryKey } from '@/i18n/dictionary'

export interface LegalSectionDef {
  id: string
  headingKey: DictionaryKey
}

interface LegalPageLayoutProps {
  titleKey: DictionaryKey
  lastUpdatedKey: DictionaryKey
  intro?: DictionaryKey
  sections?: LegalSectionDef[]
  children: ReactNode
  className?: string
}

function formatLegalDate(locale: 'it' | 'en'): string {
  return new Date().toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Layout pagine legali — design "Brand tenue" minimal:
 * - Superficie velatura brand tenue (lilla → off-white), articolo bianco full-bleed
 * - Header sticky minimale (wordmark + link "torna al gioco")
 * - Indice "IN QUESTA PAGINA" solo desktop (sticky, link testuali, scrollspy)
 * - Mobile: niente accordion, pagina che scorre dritta
 * - Colonna di lettura ~75ch (token --measure-wide)
 */
export function LegalPageLayout({
  titleKey,
  lastUpdatedKey,
  intro,
  sections = [],
  children,
  className,
}: LegalPageLayoutProps) {
  const { t, locale } = useLocale()

  const tocItems: LegalTocItem[] = sections.map((s) => ({
    id: s.id,
    label: t(s.headingKey),
  }))
  const tocLabel = locale === 'it' ? 'In questa pagina' : 'On this page'

  return (
    <SectionFrame theme="legal" grow clip className={cn('legal-surface flex flex-col', className)}>
      <a className="legal-skip-link" href="#legal-content">
        {locale === 'it' ? 'Salta al contenuto' : 'Skip to content'}
      </a>

      <header className="safe-px sticky top-0 z-20 border-b border-ink/10 bg-[color-mix(in_srgb,var(--background)_88%,transparent)] pt-(--safe-top) backdrop-blur-sm">
        <div className="content-max mx-auto flex items-center justify-between gap-4 py-2.5">
          <span className="text-base font-black lowercase tracking-tighter text-ink">
            fantacer<span className="text-orange">★</span>
          </span>
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-wider text-ink/70 transition-colors hover:text-ink"
          >
            {t('legal.backToGame')}
          </Link>
        </div>
      </header>

      <div className="content-max safe-px mx-auto w-full flex-1 py-(--section-pad) lg:py-(--space-3xl)">
        <div className="flex w-full flex-col gap-10 lg:flex-row lg:gap-12">
          {sections.length > 0 && <LegalToc items={tocItems} label={tocLabel} />}

          <article
            className="w-full min-w-0 flex-1 bg-white px-(--space-md) py-(--section-pad) sm:px-(--space-lg)"
            id="legal-content"
            aria-labelledby="legal-page-title"
            tabIndex={-1}
          >
            <div className="prose-legal mx-auto max-w-(--measure-wide)">
              <header className="mb-8 lg:mb-10">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-ink/50">
                  FANTACER · {locale === 'it' ? 'Info legali' : 'Legal info'}
                </p>
                <h1
                  id="legal-page-title"
                  className="text-(length:--fs-headline) font-black tracking-tighter text-ink leading-(--lh-headline) text-balance"
                >
                  {t(titleKey)}
                </h1>
                <p className="mt-2 text-xs font-medium text-ink/60">
                  {t(lastUpdatedKey, { date: formatLegalDate(locale) })}
                </p>
                {intro && <p className="mt-6 text-ink/85">{t(intro)}</p>}
              </header>

              {children}
            </div>
          </article>
        </div>
      </div>

      <SiteFooter variant="light" showCookieButton={false} />
    </SectionFrame>
  )
}

export function LegalSection({
  id,
  headingKey,
  children,
}: {
  id: string
  headingKey: DictionaryKey
  children: ReactNode
}) {
  const { t } = useLocale()
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t(headingKey)}</h2>
      {children}
    </section>
  )
}
