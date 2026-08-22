import { render, screen } from '@testing-library/react'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'it' }),
}))

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

  it('passa showCookieButton={false} al SiteFooter (3 link, no bottone cookie)', () => {
    render(
      <LegalPageLayout titleKey="cookiePolicy.title" summaryBox={<p>sintesi</p>}>
        <p>contenuto</p>
      </LegalPageLayout>,
    )
    expect(screen.queryByRole('button', { name: 'footer.cookieConsent' })).not.toBeInTheDocument()
  })
})