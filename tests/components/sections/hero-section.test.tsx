import { render, screen, fireEvent } from '@testing-library/react'
import { HeroSection } from '@/components/sections/hero-section'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))
jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

describe('HeroSection', () => {
  it('non mostra più il bottone GIOCA', () => {
    render(<HeroSection />)
    expect(screen.queryByText('GIOCA')).not.toBeInTheDocument()
  })

  it('mostra la freccia verso il basso (aria-label hero.scroll)', () => {
    render(<HeroSection />)
    expect(screen.getByRole('button', { name: 'hero.scroll' })).toBeInTheDocument()
  })

  it('chiama onScrollDown al click sulla freccia', () => {
    const onScrollDown = jest.fn()
    render(<HeroSection onScrollDown={onScrollDown} />)
    fireEvent.click(screen.getByRole('button', { name: 'hero.scroll' }))
    expect(onScrollDown).toHaveBeenCalledTimes(1)
  })
})