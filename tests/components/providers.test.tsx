import { render, screen } from '@testing-library/react'
import { Providers } from '@/components/providers'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

// Il componente reale usa useParams/useSearchParams di next/navigation (qui non
// mockati) e inietta uno script: nei test basta sapere se viene montato.
jest.mock('@vercel/analytics/next', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}))

/**
 * Regressione: su browser mobile con site-data bloccati `document.cookie`
 * lancia SecurityError. `readConsentCookie()` (consent-cookie core) è no-throw
 * → nessun crash durante il render. Il ConsentErrorBoundary resta come rete di
 * sicurezza: se qualcosa nel blocco cookie/analytics fallisce, rende il
 * contenuto della pagina senza banner cookie né Analytics.
 */
describe('Providers', () => {
  let cookieGetter: jest.SpyInstance

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    cookieGetter = jest.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
  })

  afterEach(() => {
    cookieGetter.mockRestore()
  })

  it('rende il contenuto della pagina quando document.cookie lancia SecurityError', () => {
    expect(() =>
      render(
        <Providers locale="it">
          <div>contenuto pagina</div>
        </Providers>
      )
    ).not.toThrow()
    expect(screen.getByText('contenuto pagina')).toBeInTheDocument()
  })

  it('non monta il blocco cookie sulle rotte admin', () => {
    mockUsePathname.mockReturnValue('/admin/dashboard')
    render(
      <Providers locale="it">
        <div>pannello admin</div>
      </Providers>
    )
    expect(screen.getByText('pannello admin')).toBeInTheDocument()
  })

  it('monta Vercel Analytics sulle rotte pubbliche e non su admin', () => {
    mockUsePathname.mockReturnValue('/')
    const { unmount } = render(
      <Providers locale="it">
        <div>contenuto pagina</div>
      </Providers>
    )
    expect(screen.getByTestId('vercel-analytics')).toBeInTheDocument()
    unmount()

    mockUsePathname.mockReturnValue('/admin/dashboard')
    render(
      <Providers locale="it">
        <div>pannello admin</div>
      </Providers>
    )
    expect(screen.queryByTestId('vercel-analytics')).not.toBeInTheDocument()
  })
})