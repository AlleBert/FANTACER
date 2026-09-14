import { render, screen } from '@testing-library/react'
import { SiteFooter } from '@/components/layout/site-footer'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))

describe('SiteFooter', () => {
  const LEGAL_HREFS = ['/cookie-policy', '/privacy-policy', '/terms-and-conditions']
  const legalLinks = () =>
    screen.getAllByRole('link').filter((l) => LEGAL_HREFS.includes(l.getAttribute('href') ?? ''))

  it('renderizza il bottone preferenze cookie di default (variant dark)', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('button', { name: 'footer.cookieConsent' })).toBeInTheDocument()
  })

  it('con showCookieButton={false} NON renderizza il bottone cookie', () => {
    render(<SiteFooter showCookieButton={false} />)
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
  })

  it('con variant light i link legali NON aprono nuova tab (niente target="_blank")', () => {
    render(<SiteFooter variant="light" />)
    const links = legalLinks()
    expect(links.length).toBe(3)
    for (const l of links) {
      expect(l.getAttribute('target')).toBeNull()
    }
  })

  it('con variant dark i link legali aprono nuova tab (target="_blank" + rel noopener)', () => {
    render(<SiteFooter />)
    const links = legalLinks()
    expect(links.length).toBe(3)
    for (const l of links) {
      expect(l.getAttribute('target')).toBe('_blank')
      expect(l.getAttribute('rel')).toContain('noopener')
    }
  })

  it('mostra il credito archi467 con logo', () => {
    render(<SiteFooter />)
    expect(screen.getByText('footer.formatBy.before')).toBeInTheDocument()
    expect(screen.getByAltText('archi467')).toHaveAttribute('src', '/brand/archi467-nopayoff.webp')
  })

  it('rende il logo archi467 cliccabile verso Instagram', () => {
    render(<SiteFooter />)
    const archi = screen.getByRole('link', { name: 'archi467' })
    expect(archi).toHaveAttribute('href', 'https://www.instagram.com/archi.467/')
    expect(archi).toHaveAttribute('target', '_blank')
    expect(archi.getAttribute('rel')).toContain('noopener')
  })
})