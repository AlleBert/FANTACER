import { render, screen } from '@testing-library/react'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

describe('PrizeLocationSection', () => {
  it('mostra titolo e info sede senza card sponsor', () => {
    render(<PrizeLocationSection />)
    expect(screen.getByText('prize.title')).toBeInTheDocument()
    expect(screen.getByText('prize.venue')).toBeInTheDocument()
    expect(screen.getByText('prize.dates')).toBeInTheDocument()
  })
})
