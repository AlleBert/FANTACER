'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Check, SlidersHorizontal, X } from 'lucide-react'
import { useCookieConsent, type CookieCategories, type DetailedCookieConsent } from 'react-cookie-manager'

import { useLocale } from '@/lib/LocaleContext'
import { cn } from '@/lib/utils'
import { ModalShell } from '@/components/ui/modal-shell'

export const OPEN_COOKIE_PREFERENCES_EVENT = 'fantacer:open-cookie-preferences'

const noop = () => {}

export const COOKIE_CONSENT_KEY = 'fantacer_cookie_consent'

/**
 * Categorie per cui viene richiesto il consenso. La webapp usa solo cookie
 * essenziali: nessuna categoria opzionale è attiva. Quando in futuro saranno
 * aggiunti cookie analitici/social/pubblicitari, basta attivare qui la relativa
 * voce (e fornire i contenuti) e i toggle riappaiono nel pannello.
 */
export const COOKIE_CATEGORIES: CookieCategories = {
  Analytics: true,
  Social: false,
  Advertising: false,
}

const CATEGORY_KEYS = {
  Analytics: { titleKey: 'cookie.analyticsTitle', subtitleKey: 'cookie.analyticsSubtitle' },
  Social: { titleKey: 'cookie.socialTitle', subtitleKey: 'cookie.socialSubtitle' },
  Advertising: { titleKey: 'cookie.advertTitle', subtitleKey: 'cookie.advertSubtitle' },
} as const

const OPTIONAL_CATEGORIES = (['Analytics', 'Social', 'Advertising'] as const)
  .filter((id) => COOKIE_CATEGORIES[id])
  .map((id) => ({ id, ...CATEGORY_KEYS[id] }))

/**
 * La libreria legge il cookie una sola volta in un initializer di useState, che
 * durante l'SSR gira senza `window` e resta quindi a `null` lato client dopo un
 * reload completo. Qui rileggiamo il cookie lato client: decide se mostrare il
 * banner e inizializza le preferenze nel pannello. La cache sul raw value rende
 * `getSnapshot` stabile (richiesto da useSyncExternalStore).
 */
let cachedConsentRaw: string | null = null
let cachedConsentValue: DetailedCookieConsent | null = null

function readStoredConsent(): DetailedCookieConsent | null {
  if (typeof window === 'undefined') return null
  const prefix = `${COOKIE_CONSENT_KEY}=`
  const row = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix))
  const raw = row ? row.slice(prefix.length) : null
  if (raw === cachedConsentRaw) return cachedConsentValue
  cachedConsentRaw = raw
  cachedConsentValue = null
  if (raw) {
    const candidates = [raw]
    try {
      candidates.push(decodeURIComponent(raw))
    } catch {
      /* valore non encodato */
    }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed && typeof parsed === 'object') {
          cachedConsentValue = parsed as DetailedCookieConsent
          break
        }
      } catch {
        /* formato non valido */
      }
    }
  }
  return cachedConsentValue
}

const cookieStoreSubscribe = () => () => {}

/** Stato sconosciuto durante SSR/hydration: il banner non viene pre-renderizzato. */
const UNKNOWN_CONSENT = Symbol('unknown-consent')

type StoredConsent = DetailedCookieConsent | null | typeof UNKNOWN_CONSENT

function useStoredConsent(): StoredConsent {
  return useSyncExternalStore<StoredConsent>(
    cookieStoreSubscribe,
    () => readStoredConsent(),
    () => UNKNOWN_CONSENT
  )
}

const btnBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-[3px] border-ink px-5 py-2.5 text-sm font-black text-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 active:scale-[0.98]'

const btnPrimary = cn(
  btnBase,
  'bg-bright shadow-[3px_3px_0_#000] hover:-translate-y-0.5 hover:bg-[#c99900] hover:shadow-[5px_5px_0_#000]'
)

const btnSecondary = cn(
  btnBase,
  'bg-white shadow-[3px_3px_0_#000] hover:-translate-y-0.5 hover:bg-question-blue hover:shadow-[5px_5px_0_#000]'
)

const btnTertiary = cn(
  btnBase,
  'bg-question-blue shadow-[3px_3px_0_#000] hover:-translate-y-0.5 hover:bg-[#a8c7e6] hover:shadow-[5px_5px_0_#000]'
)

const cardCls = 'relative w-full p-5 sm:p-7'

const titleCls = 'text-lg font-black uppercase tracking-tighter text-ink sm:text-xl'

const bodyCls = 'mt-2 text-sm font-medium text-ink/80'

function buildInitialDraft(detailedConsent: DetailedCookieConsent | null): CookieCategories {
  const source = readStoredConsent() ?? detailedConsent
  return {
    Analytics: source?.Analytics?.consented ?? false,
    Social: source?.Social?.consented ?? false,
    Advertising: source?.Advertising?.consented ?? false,
  }
}

function CookieToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 flex-none cursor-pointer rounded-full border-2 border-ink shadow-[2px_2px_0_#000] transition-colors duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2',
        checked ? 'bg-purple' : 'bg-[#e5e7eb]'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200',
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        )}
      />
    </button>
  )
}

export function CookieConsentUI() {
  const { t } = useLocale()
  const { detailedConsent, acceptCookies, declineCookies, updateDetailedConsent } = useCookieConsent()
  const stored = useStoredConsent()

  const [view, setView] = useState<'banner' | 'manage' | null>(null)
  const [draft, setDraft] = useState<CookieCategories>(() => buildInitialDraft(detailedConsent))

  useEffect(() => {
    const open = () => {
      setDraft(buildInitialDraft(detailedConsent))
      setView('manage')
    }
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open)
  }, [detailedConsent])

  const openManage = () => {
    setDraft(buildInitialDraft(detailedConsent))
    setView('manage')
  }

  const handleAccept = () => {
    setView(null)
    acceptCookies()
  }

  const handleDecline = () => {
    setView(null)
    declineCookies()
  }

  const handleBack = () => {
    setView('banner')
  }

  const handleConfirm = () => {
    setView(null)
    updateDetailedConsent(draft)
  }

  const hasConsent = stored !== null
  const showBanner = view === 'banner' || (view === null && !hasConsent)
  const showManage = view === 'manage'

  return (
    <ModalShell
      open={showBanner || showManage}
      onClose={noop}
      dismissible={false}
      labelledBy={showBanner ? 'fantacer-cookie-title' : 'fantacer-cookie-manage-title'}
      className="max-w-md rounded-3xl border-[3px] border-ink bg-white shadow-[6px_6px_0_#000]"
    >
      {showBanner ? (
        <div className={cardCls}>
          <h2 id="fantacer-cookie-title" className={titleCls}>
            {t('cookie.title')}
          </h2>
          <p className={bodyCls}>{t('cookie.message')}</p>

          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={openManage} className={cn(btnTertiary, 'w-full sm:w-auto')}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {t('cookie.manageButtonText')}
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={handleDecline} className={cn(btnSecondary, 'w-full sm:flex-1')}>
                <X className="size-4" aria-hidden="true" />
                {t('cookie.declineButtonText')}
              </button>
              <button type="button" onClick={handleAccept} className={cn(btnPrimary, 'w-full sm:flex-1')}>
                <Check className="size-4" aria-hidden="true" />
                {t('cookie.buttonText')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(cardCls, 'max-h-[85dvh] overflow-y-auto')}>
          <h2 id="fantacer-cookie-manage-title" className={titleCls}>
            {t('cookie.manageTitle')}
          </h2>
          <p className={bodyCls}>{t('cookie.manageMessage')}</p>

          <div className="mt-4">
            <div className="flex items-start justify-between gap-3 border-b-2 border-ink/10 py-3">
              <div>
                <h3 className="text-sm font-bold text-ink">{t('cookie.essentialTitle')}</h3>
                <p className="mt-0.5 text-xs text-ink/70">{t('cookie.essentialSubtitle')}</p>
              </div>
              <span className="rounded-full border-2 border-ink/30 bg-[#e5e7eb] px-3 py-1 text-xs font-bold text-ink/60">
                {t('cookie.essentialStatus')}
              </span>
            </div>

            {OPTIONAL_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="flex items-start justify-between gap-3 border-b-2 border-ink/10 py-3"
              >
                <div>
                  <h3 className="text-sm font-bold text-ink">{t(cat.titleKey)}</h3>
                  <p className="mt-0.5 text-xs text-ink/70">{t(cat.subtitleKey)}</p>
                </div>
                <CookieToggle
                  checked={draft[cat.id] ?? false}
                  label={t(cat.titleKey)}
                  onChange={(next) => setDraft((prev) => ({ ...prev, [cat.id]: next }))}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleBack} className={cn(btnSecondary, 'w-full sm:flex-1')}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('cookie.cancelButtonText')}
            </button>
            <button type="button" onClick={handleConfirm} className={cn(btnPrimary, 'w-full sm:flex-1')}>
              <Check className="size-4" aria-hidden="true" />
              {t('cookie.saveButtonText')}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
