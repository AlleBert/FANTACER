import { render, screen, act } from '@testing-library/react'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import CookiePolicyPage from '@/app/cookie-policy/page'
import PrivacyPolicyPage from '@/app/privacy-policy/page'
import TermsAndConditionsPage from '@/app/terms-and-conditions/page'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'it' }),
}))

jest.mock('@/lib/legal', () => ({
  getLegalLocale: jest.fn(async () => 'it'),
  makeLegalT: () => ((key: string) => key),
}))

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
  it('renderizza il link "torna al gioco" con parola chiave legal.backToGame', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const back = screen.getByRole('link', { name: 'legal.backToGame' })
    expect(back).toBeInTheDocument()
  })

  it('applica la superficie velatura (classe legal-surface)', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    const surface = container.querySelector('.legal-surface')
    expect(surface).not.toBeNull()
  })

  it('renderizza l\'article bianco con id legal-content', () => {
    const { container } = render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(container.querySelector('#legal-content')).not.toBeNull()
  })

  it('espone uno skip link verso il contenuto legale', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )

    expect(screen.getByRole('link', { name: /salta|skip/i })).toHaveAttribute('href', '#legal-content')
  })

  it('footer mostra 6 link (skip + back-to-game + 3 footer links + archi467) e nessun bottone cookie', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
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
        lastUpdatedKey="cookiePolicy.lastUpdated"
        sections={[
          { id: 'what-are-cookies', headingKey: 'cookiePolicy.whatAreCookies' },
          { id: 'categories', headingKey: 'cookiePolicy.categories' },
        ]}
      >
        <section id="what-are-cookies"><h2 id="what-are-cookies-heading">What Are Cookies</h2></section>
        <section id="categories"><h2 id="categories-heading">Categories</h2></section>
      </LegalPageLayout>,
    )
    act(() => {
      if (ioCallback) {
        ioCallback?.([{ isIntersecting: true, target: { id: 'categories' } } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
      }
    })
    const categoriesLink = document.querySelector('a[href="#categories"]')
    expect(categoriesLink?.classList.contains('is-scrollspy-active')).toBe(true)
    const whatAreCookiesLink = document.querySelector('a[href="#what-are-cookies"]')
    expect(whatAreCookiesLink?.classList.contains('is-scrollspy-active')).toBe(false)
  })
  it('usa l\'indice come unica fonte di etichetta per la sezione legale', () => {
    render(
      <LegalPageLayout
        titleKey="cookiePolicy.title"
        lastUpdatedKey="cookiePolicy.lastUpdated"
        sections={[{ id: 'controller', headingKey: 'privacyPolicy.controller' }]}
      >
        <LegalSection id="controller">
          <p>Contenuto della sezione.</p>
        </LegalSection>
      </LegalPageLayout>,
    )

    expect(screen.getByRole('link', { name: 'privacyPolicy.controller' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'privacyPolicy.controller' })).not.toBeInTheDocument()
  })
  it('mantiene paragrafi esplicativi nelle sezioni legali anche quando contengono liste o tabelle', async () => {
    const { container: cookieContainer } = render(await CookiePolicyPage())
    const { container: privacyContainer } = render(await PrivacyPolicyPage())
    const { container: termsContainer } = render(await TermsAndConditionsPage())

    expect(cookieContainer.querySelectorAll('p').length).toBeGreaterThan(0)
    expect(privacyContainer.querySelectorAll('p').length).toBeGreaterThan(0)
    expect(termsContainer.querySelectorAll('p').length).toBeGreaterThan(0)

    expect(cookieContainer.querySelector('#what-are-cookies p')).not.toBeNull()
    expect(privacyContainer.querySelector('#retention p, #retention table')).not.toBeNull()
    expect(termsContainer.querySelector('#participation p')).not.toBeNull()
  })

  it('non lascia l\'href nel pathname e scrolla alla sezione corretta', () => {
    const scrollTo = jest.fn()
    window.scrollTo = scrollTo as typeof window.scrollTo
    window.history.replaceState({}, '', '/privacy-policy')

    render(
      <LegalPageLayout
        titleKey="privacyPolicy.title"
        lastUpdatedKey="privacyPolicy.lastUpdated"
        sections={[
          { id: 'controller', headingKey: 'privacyPolicy.controller' },
          { id: 'rights', headingKey: 'privacyPolicy.rights' },
        ]}
      >
        <LegalSection id="controller"><p>Controller</p></LegalSection>
        <LegalSection id="rights"><p>Rights</p></LegalSection>
      </LegalPageLayout>,
    )

    const targetLink = screen.getByRole('link', { name: 'privacyPolicy.rights' })
    targetLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(window.location.hash).toBe('')
    expect(scrollTo).toHaveBeenCalled()
  })

  it('non esiste elemento mobile details nella DOM', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" lastUpdatedKey="cookiePolicy.lastUpdated" sections={[]}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
    expect(document.querySelector('details')).not.toBeInTheDocument()
  })
})