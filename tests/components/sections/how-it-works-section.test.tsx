import { render, screen } from '@testing-library/react'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))
jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

describe('HowItWorksSection', () => {
  it('mostra il nuovo titolo e la card classifica', () => {
    const { container } = render(<HowItWorksSection />)
    expect(screen.getByText('howItWorks.title.line1')).toBeInTheDocument()
    expect(screen.getByText('howItWorks.title.line2')).toBeInTheDocument()
    expect(screen.getByText('howItWorks.step.ranking')).toBeInTheDocument()
    expect(screen.queryByText('howItWorks.step.collect')).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-up')).not.toBeNull()
  })
})
