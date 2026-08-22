import { render, screen } from '@testing-library/react'
import { SiteFooter } from '@/components/layout/site-footer'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

describe('SiteFooter', () => {
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
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(3)
    for (const l of links) {
      expect(l.getAttribute('target')).toBeNull()
    }
  })

  it('con variant dark i link legali aprono nuova tab (target="_blank" + rel noopener)', () => {
    render(<SiteFooter />)
    const links = screen.getAllByRole('link')
    expect(links.length).toBe(3)
    for (const l of links) {
      expect(l.getAttribute('target')).toBe('_blank')
      expect(l.getAttribute('rel')).toContain('noopener')
    }
  })
})