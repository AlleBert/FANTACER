import { render, screen } from '@testing-library/react'
import { Providers } from '@/components/providers'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

/**
 * Regressione: su browser mobile con site-data bloccati `document.cookie`
 * lancia SecurityError. `react-cookie-manager@5.3.0#getCookie()` lo legge
 * senza try/catch nell'initializer di useState di <CookieManager> → crash
 * durante il render → `global-error.tsx` → phantom 500 client-side con HTTP
 * 200 dal server. Il ConsentErrorBoundary deve catturare l'errore e rendere
 * il contenuto della pagina senza banner cookie né Analytics.
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
})