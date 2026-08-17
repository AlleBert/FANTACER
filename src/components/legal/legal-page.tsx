'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { SectionFrame } from '@/components/layout/section-frame'
import { cn } from '@/lib/utils'
import { useLocale } from '@/lib/LocaleContext'
import { sectionThemes } from '@/lib/section-themes'
import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/cookie-consent'

import type { DictionaryKey } from '@/i18n/dictionary'

interface LegalPageProps {
  children: ReactNode
  theme?: 'contact' | 'legal'
  className?: string
  toc?: Array<{ id: string; label: string }>
  titleKey: DictionaryKey
  lastUpdatedKey?: DictionaryKey
}

export function LegalPage({
  children,
  theme = 'legal',
  className,
  toc = [],
  titleKey,
  lastUpdatedKey = 'cookiePolicy.lastUpdated',
}: LegalPageProps) {
  const { t, locale } = useLocale()
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const today = new Date()
  const formattedDate = today.toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <SectionFrame
      theme={theme}
      grow
      className={cn('flex flex-col', className)}
    >
      {/* Sfondo brand fisso: copre tutto il viewport durante lo scroll (le pagine
          legali non passano da AppShell/BackgroundLayer). */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: sectionThemes[theme].background }}
      />

      <div className="safe-shell content-max relative z-10 flex flex-1 flex-col min-h-0">
        <div className="flex-1 flex w-full flex-col min-h-0 overflow-y-auto py-(--section-pad) lg:py-[clamp(2rem,4vw,4rem)]">
          {/* Desktop TOC Sidebar - Brand Pills */}
          {toc.length > 0 && (
            <aside
              className="toc hidden lg:block lg:w-[220px] lg:flex-shrink-0 lg:sticky lg:top-[calc(var(--section-pad)+1rem)] lg:self-start lg:max-h-[calc(100dvh-var(--section-pad)*2)] lg:overflow-y-auto lg:pr-4"
              aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}
            >
              <nav className="space-y-2">
                <p className="mb-3 w-fit rounded-full border-2 border-ink/20 bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink shadow-[2px_2px_0_#000]">
                  {locale === 'it' ? 'In questa pagina' : 'On this page'}
                </p>
                <ul className="space-y-1.5" role="list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="toc-pill block w-full px-3 py-2 text-xs font-black uppercase tracking-wider text-ink/70 border-2 border-ink/20 rounded-full hover:border-ink hover:bg-ink/5 hover:text-ink transition-all duration-150"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          {/* Mobile TOC Trigger */}
          {toc.length > 0 && (
            <button
              type="button"
              className="lg:hidden w-full mb-4 px-4 py-3 text-left font-black uppercase tracking-wider text-sm text-ink border-2 border-ink/20 rounded-full bg-white/90 backdrop-blur-sm shadow-[4px_4px_0_#000] hover:border-ink hover:bg-white transition-all duration-150 active:shadow-[2px_2px_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
              onClick={() => setMobileTocOpen(true)}
              aria-label={locale === 'it' ? 'Apri indice' : 'Open table of contents'}
              aria-expanded={mobileTocOpen}
              aria-controls="mobile-toc-drawer"
            >
              {locale === 'it' ? 'Indice' : 'Contents'}
            </button>
          )}

          <article
            className="flex-1 w-full max-w-(--measure-wide) mx-auto prose-legal bg-white border-[3px] border-ink rounded-[2.25rem] shadow-[6px_6px_0_#000] p-[clamp(1rem,min(3vw,4svh),2.5rem)] sm:p-[clamp(1.5rem,min(3vw,4svh),3rem)]"
            id="legal-content"
          >
            <header className="mb-[clamp(1.5rem,3vw,2.5rem)] pb-[clamp(1rem,2vw,1.5rem)] border-b-[3px] border-ink">
              <span className="mb-4 inline-block rounded-full border-2 border-ink bg-bright px-4 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0_#000]">
                FANTACER · {locale === 'it' ? 'Info legali' : 'Legal info'}
              </span>
              <h1 className="text-(length:--fs-headline-tight) font-black uppercase tracking-tighter text-ink leading-(--lh-headline) text-balance">
                {t(titleKey)}
              </h1>
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-ink/70">
                {t(lastUpdatedKey, { date: formattedDate })}
              </p>
            </header>

            {children}
          </article>
        </div>

        {/* Mobile TOC Drawer (Bottom Sheet) */}
        {toc.length > 0 && mobileTocOpen && (
          <div
            id="mobile-toc-drawer"
            className="lg:hidden fixed inset-0 z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={locale === 'it' ? 'Indice' : 'Table of contents'}
          >
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileTocOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative flex-1 flex flex-col bg-white border-t-4 border-ink shadow-[0_-8px_0_#000] animate-slide-up">
              <header className="flex items-center justify-between p-4 border-b-2 border-ink/10">
                <h2 className="text-sm font-black uppercase tracking-wider text-ink">
                  {locale === 'it' ? 'Indice' : 'Contents'}
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileTocOpen(false)}
                  className="p-2 text-ink/50 hover:text-ink transition-colors"
                  aria-label={locale === 'it' ? 'Chiudi indice' : 'Close table of contents'}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </header>
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <ul className="space-y-1.5" role="list">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={() => setMobileTocOpen(false)}
                        className="toc-pill block w-full px-4 py-3 text-sm font-black uppercase tracking-wider text-ink border-2 border-ink/20 rounded-full hover:border-ink hover:bg-ink/5 hover:text-ink transition-all duration-150 active:shadow-[2px_2px_0_#000] active:translate-x-[2px] active:translate-y-[2px]"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        )}

        <footer className="flex-shrink-0 pb-[max(0.5rem,var(--safe-bottom))] pt-[clamp(0.5rem,1.5vw,1rem)]">
          <div className="safe-px mx-auto flex w-full max-w-(--measure-wide) flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs font-black uppercase tracking-wider text-white/85">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
              className="inline-flex items-center min-h-11 py-2 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
            >
              {t('footer.cookieConsent')}
            </button>
            <span aria-hidden="true">•</span>
            <a href="/cookie-policy" className="inline-flex items-center min-h-11 py-2 underline decoration-2 underline-offset-4 hover:text-white transition-colors">{t('footer.cookiePolicy')}</a>
            <span aria-hidden="true">•</span>
            <a href="/privacy-policy" className="inline-flex items-center min-h-11 py-2 underline decoration-2 underline-offset-4 hover:text-white transition-colors">{t('footer.privacyPolicy')}</a>
            <span aria-hidden="true">•</span>
            <a href="/terms-and-conditions" className="inline-flex items-center min-h-11 py-2 underline decoration-2 underline-offset-4 hover:text-white transition-colors">{t('footer.terms')}</a>
          </div>
        </footer>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </SectionFrame>
  )
}