import { render, screen } from '@testing-library/react'
import { CookieConsentUI, COOKIE_CONSENT_KEY } from '@/components/cookie-consent'
import { LocaleProvider } from '@/lib/LocaleContext'

jest.mock('react-cookie-manager', () => ({
  useCookieConsent: () => ({
    hasConsent: null,
    isDeclined: false,
    detailedConsent: null,
    showConsentBanner: jest.fn(),
    acceptCookies: jest.fn(),
    declineCookies: jest.fn(),
    updateDetailedConsent: jest.fn(),
    openPreferencesModal: jest.fn(),
  }),
}))

/**
 * Regressione: su browser mobile con site-data bloccati (Safari private
 * browsing, "Prevent Cross-Site Tracking", in-app browser) `document.cookie`
 * lancia DOMException SecurityError. `readStoredConsent()` leggeva
 * `document.cookie` senza try/catch durante il render (getSnapshot di
 * useSyncExternalStore + initializer di useState) → crash React →
 * `global-error.tsx` → phantom 500 client-side con HTTP 200 dal server.
 */
describe('CookieConsentUI', () => {
  let cookieGetter: jest.SpyInstance

  beforeEach(() => {
    cookieGetter = jest.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  })

  afterEach(() => {
    cookieGetter.mockRestore()
  })

  it('non lancia SecurityError e mostra il banner quando document.cookie è bloccato', () => {
    expect(() =>
      render(
        <LocaleProvider locale="it">
          <CookieConsentUI />
        </LocaleProvider>
      )
    ).not.toThrow()
    expect(screen.getByRole('heading', { name: 'Cookie & Privacy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accetta tutto' })).toBeInTheDocument()
  })

  it('nasconde il banner quando il consenso è già salvato (happy path intatto)', () => {
    cookieGetter.mockRestore()
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
      JSON.stringify({ Analytics: { consented: true, timestamp: new Date().toISOString() } })
    )}`
    render(
      <LocaleProvider locale="it">
        <CookieConsentUI />
      </LocaleProvider>
    )
    expect(screen.queryByRole('heading', { name: 'Cookie & Privacy' })).not.toBeInTheDocument()
  })
})