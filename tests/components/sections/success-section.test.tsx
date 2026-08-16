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
  // jsdom non implementa matchMedia: di default è undefined, il restore in
  // afterEach ripristina lo stato iniziale (ancora undefined).
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
})
