'use client'

import { useLocale } from '@/lib/LocaleContext'
import { OPEN_COOKIE_PREFERENCES_EVENT } from '@/components/cookie-consent'
import { cn } from '@/lib/utils'

const FOOTER_LINKS = {
  cookiePolicy: '/cookie-policy',
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
} as const

interface SiteFooterProps {
  /** dark = sfondo scuro (ContactSection homepage); light = superficie chiara (legal pages) */
  variant?: 'dark' | 'light'
  /** false → non renderizza il bottone "Preferenze cookie" (legal pages) */
  showCookieButton?: boolean
}

export function SiteFooter({ variant = 'dark', showCookieButton = true }: SiteFooterProps) {
  const { t } = useLocale()
  const target = variant === 'dark' ? '_blank' : undefined
  const rel = variant === 'dark' ? 'noopener noreferrer' : undefined

  const linkCls = cn(
    'inline-flex items-center min-h-11 py-2 text-xs font-bold uppercase tracking-wider underline decoration-2 underline-offset-4 transition-colors',
    variant === 'dark' ? 'text-white/85 hover:text-white' : 'text-ink/70 hover:text-ink',
  )
  const sepCls = variant === 'dark' ? 'text-white/40' : 'text-ink/40'

  return (
    <footer className="flex-shrink-0 pb-[max(0.5rem,var(--safe-bottom))] pt-[clamp(0.5rem,1.5vw,1rem)]">
      <div className="safe-px mx-auto flex w-full max-w-[min(95vw,900px)] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        {showCookieButton && (
          <>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT))}
              className={linkCls}
            >
              {t('footer.cookieConsent')}
            </button>
            <span className={sepCls} aria-hidden="true">•</span>
          </>
        )}
        <a href={FOOTER_LINKS.cookiePolicy} target={target} rel={rel} className={linkCls}>
          {t('footer.cookiePolicy')}
        </a>
        <span className={sepCls} aria-hidden="true">•</span>
        <a href={FOOTER_LINKS.privacy} target={target} rel={rel} className={linkCls}>
          {t('footer.privacyPolicy')}
        </a>
        <span className={sepCls} aria-hidden="true">•</span>
        <a href={FOOTER_LINKS.terms} target={target} rel={rel} className={linkCls}>
          {t('footer.terms')}
        </a>
      </div>
    </footer>
  )
}