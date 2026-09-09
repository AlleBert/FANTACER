import { render, screen, act, fireEvent } from '@testing-library/react'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'it' }),
}))

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]
  constructor(cb: IntersectionObserverCallback) {
    ;(global as any).ioCallback = cb
  }
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
  takeRecords = (): IntersectionObserverEntry[] => []
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

describe('LegalPageLayout', () => {
  it('renderizza il link "torna al gioco" con parola chiave legal.backToGame', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const back = screen.getByRole('link', { name: 'legal.backToGame' })
    expect(back).toBeInTheDocument()
  })

  it('applica la superficie velatura (classe legal-surface)', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const surface = container.querySelector('.legal-surface')
    expect(surface).not.toBeNull()
  })

  it('renderizza l\'article bianco con id legal-content', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(container.querySelector('#legal-content')).not.toBeNull()
  })

  it('espone uno skip link verso il contenuto legale', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )

    expect(screen.getByRole('link', { name: /salta|skip/i })).toHaveAttribute('href', '#legal-content')
  })

  it('footer mostra 6 link (skip + back-to-game + footer nav + credit) e nessun bottone cookie', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').length).toBe(6)
  })

  it('evidenzia la voce indice attiva nello scrollspy desktop (nessun details mobile)', () => {
    render(
      <LegalPageLayout
        titleKey="cookiePolicy.title"
        sections={[
          { id: 'controller', headingKey: 'cookiePolicy.controller' },
          { id: 'dpo', headingKey: 'cookiePolicy.dpo' },
        ]}
      >
        <section id="controller"><h2 id="controller-heading">Controller</h2></section>
        <section id="dpo"><h2 id="dpo-heading">DPO</h2></section>
      </LegalPageLayout>,
    )
    act(() => {
      const cb = (global as any).ioCallback
      if (cb) {
        cb?.([{ isIntersecting: true, target: { id: 'dpo' } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
      }
    })
    const dpoLink = document.querySelector('a[href="#dpo"]')
    expect(dpoLink?.classList.contains('is-scrollspy-active')).toBe(true)
    const controllerLink = document.querySelector('a[href="#controller"]')
    expect(controllerLink?.classList.contains('is-scrollspy-active')).toBe(false)
  })

  it('non esiste elemento mobile details nella DOM', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
    expect(document.querySelector('details')).not.toBeInTheDocument()
  })
})