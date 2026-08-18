import { render, screen } from '@testing-library/react'
import { CtaButton } from '@/components/ui/cta-button'

describe('CtaButton', () => {
  it('renderizza il bottone CTA con la geometria fluida', () => {
    render(<CtaButton>GIOCA</CtaButton>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent('GIOCA')
    expect(btn.className).toContain('rounded-full')
    expect(btn.className).toContain('bg-bright')
    expect(btn.className).toContain('border-[3px]')
  })

  it('applica la scala come --cta-scale', () => {
    render(<CtaButton scale={1.15}>GIOCA</CtaButton>)
    expect(screen.getByRole('button').style.getPropertyValue('--cta-scale')).toBe('1.15')
  })

  it('invia onClick', () => {
    const onClick = jest.fn()
    render(<CtaButton onClick={onClick}>GIOCA</CtaButton>)
    screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalled()
  })
})
