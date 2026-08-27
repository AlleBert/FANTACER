import {
  readConsentCookie,
  writeConsentCookie,
  COOKIE_CONSENT_KEY,
} from '@/lib/consent-cookie'

describe('consent-cookie', () => {
  beforeEach(() => {
    document.cookie = `${COOKIE_CONSENT_KEY}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    jest.clearAllMocks()
  })

  it('legge il consenso salvato nel formato react-cookie-manager', () => {
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
      JSON.stringify({ Analytics: { consented: true, timestamp: '2026-01-01T00:00:00.000Z' } })
    )}`
    const consent = readConsentCookie()
    expect(consent?.Analytics.consented).toBe(true)
    expect(consent?.Social.consented).toBe(false)
  })

  it('restituisce null senza lanciare quando document.cookie lancia SecurityError', () => {
    const spy = jest.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    expect(readConsentCookie()).toBeNull()
    spy.mockRestore()
  })

  it('scrive il consenso preservando le categorie non toccate', () => {
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
      JSON.stringify({ Analytics: { consented: true, timestamp: '2026-01-01T00:00:00.000Z' } })
    )}`
    writeConsentCookie({ Social: { consented: true, timestamp: '2026-01-02T00:00:00.000Z' } })
    const consent = readConsentCookie()
    expect(consent?.Analytics.consented).toBe(true)
    expect(consent?.Social.consented).toBe(true)
  })

  it('tratta il cookie vuoto {} come consenso dato con categorie false (banner nascosto)', () => {
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent('{}')}`
    const consent = readConsentCookie()
    expect(consent).not.toBeNull()
    expect(consent?.Analytics.consented).toBe(false)
  })
})
