import { render, screen, act } from '@testing-library/react'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'it' }),
}))

type MockEntry = { isIntersecting: boolean; target: { id: string } }

let ioCallback: IntersectionObserverCallback | null = null

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb
  }
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
  takeRecords = (): IntersectionObserverEntry[] => []
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

describe('LegalPageLayout', () => {
  it('renderizza il bottone torna al gioco con href="/"', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" summaryBox={<p>sintesi</p>}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const back = screen.getByRole('link', { name: 'legal.backToGame' })
    expect(back.getAttribute('href')).toBe('/')
  })

  it('applica la superficie velatura (classe legal-surface)', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" summaryBox={<p>sintesi</p>}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const surface = container.querySelector('.legal-surface')
    expect(surface).not.toBeNull()
  })

  it('renderizza l\'article bianco con id legal-content', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" summaryBox={<p>sintesi</p>}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(container.querySelector('#legal-content')).not.toBeNull()
  })

  it('passa showCookieButton={false} al SiteFooter (4 link: back-to-game + 3 footer, no bottone cookie)', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" summaryBox={<p>sintesi</p>}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBe(4)
  })

  it('evidenzia la pill attiva quando una sezione entra in viewport (scrollspy)', () => {
    render(
      <LegalPageLayout
        titleKey="cookiePolicy.title"
        summaryBox={<p>sintesi</p>}
        toc={[
          { id: 'controller', label: 'controller' },
          { id: 'dpo', label: 'dpo' },
        ]}
      >
        <div id="controller" />
        <div id="dpo" />
      </LegalPageLayout>,
    )
    act(() => {
      ioCallback?.([{ isIntersecting: true, target: { id: 'dpo' } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    const dpoPill = document.querySelector('a[href="#dpo"]')
    expect(dpoPill?.className).toContain('is-active')
    const controllerPill = document.querySelector('a[href="#controller"]')
    expect(controllerPill?.className).not.toContain('is-active')
  })
})