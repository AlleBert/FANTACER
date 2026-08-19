'use client'

import { useLocale } from '@/lib/LocaleContext'
import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/cookie-consent'

const FOOTER_LINKS = {
  cookiePolicy: '/cookie-policy',
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
} as const

export function SiteFooter() {
  const { t } = useLocale()

  return (
    <footer className="flex-shrink-0 pb-[max(0.5rem,var(--safe-bottom))] pt-[clamp(0.5rem,1.5vw,1rem)]">
      <div className="safe-px mx-auto flex w-full max-w-[min(95vw,900px)] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
          className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
        >
          {t('footer.cookieConsent')}
        </button>
        <span className="text-white/40" aria-hidden="true">•</span>
        <a
          href={FOOTER_LINKS.cookiePolicy}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
        >
          {t('footer.cookiePolicy')}
        </a>
        <span className="text-white/40" aria-hidden="true">•</span>
        <a
          href={FOOTER_LINKS.privacy}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
        >
          {t('footer.privacyPolicy')}
        </a>
        <span className="text-white/40" aria-hidden="true">•</span>
        <a
          href={FOOTER_LINKS.terms}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider text-white/85 underline decoration-2 underline-offset-4 hover:text-white transition-colors"
        >
          {t('footer.terms')}
        </a>
      </div>
    </footer>
  )
}
