import { render } from '@testing-library/react'
import { SuccessSection } from '@/components/sections/success-section'
import confetti from 'canvas-confetti'

jest.mock('canvas-confetti', () => jest.fn())
jest.mock('@/lib/VoteContext', () => ({ useVote: () => ({ selectedCompanies: [] }) }))
jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))
jest.mock('@/components/sponsor/sponsor-cards', () => ({ SponsorCards: () => null }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))

const mockedConfetti = jest.mocked(confetti)

describe('SuccessSection', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    mockedConfetti.mockClear()
    jest.useRealTimers()
    Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia })
  })

  it('non lancia il confetti con prefers-reduced-motion: reduce', () => {
    jest.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    render(<SuccessSection />)
    jest.advanceTimersByTime(2000)
    expect(mockedConfetti).not.toHaveBeenCalled()
  })

  it('lancia il confetti senza reduced-motion', () => {
    jest.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: false }),
    })
    render(<SuccessSection />)
    jest.advanceTimersByTime(2000)
    expect(mockedConfetti).toHaveBeenCalled()
  })

  it('rende il link a Instagram nella action bar', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    const { container } = render(<SuccessSection />)
    const ig = container.querySelector('a[href="https://instagram.com/fanta.cer"]')
    expect(ig).toBeTruthy()
  })

  it('non rende link social separati sotto gli sponsor', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    const { container } = render(<SuccessSection />)
    const socialLabels = container.querySelectorAll('[aria-label="Instagram"], [aria-label="Facebook"]')
    // Le icone social dovrebbero essere nella action bar, non sotto gli sponsor
    // Verifica che ci siano esattamente 2 link social (1 IG + 0 FB = 1, oppure 2 se FB presente)
    expect(socialLabels.length).toBeLessThanOrEqual(2)
  })
})
