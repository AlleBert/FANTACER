import { act, render } from '@testing-library/react'
import { BackgroundLayer } from '@/components/layout/background-layer'
import { sectionThemes } from '@/lib/section-themes'

// Nota: il jest-environment-jsdom usa jsdom 20 (nested), il cui parser CSS
// scarta i valori `linear-gradient(...)` dagli inline style. I test verificano
// quindi la struttura del crossfade (layering e classe `.background-fade-in`),
// non il valore del gradiente serializzato.
describe('BackgroundLayer', () => {
  it('renders nothing when theme is null', () => {
    const { container } = render(<BackgroundLayer theme={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a fixed inset-0 viewport-level wrapper with a gradient layer', () => {
    const { container } = render(<BackgroundLayer theme="intro" />)
    const wrapper = container.firstChild as HTMLElement | null
    expect(wrapper).not.toBeNull()

    // wrapper must be viewport-level (fixed), behind content (z-0), non-interactive
    expect(wrapper?.className).toContain('fixed')
    expect(wrapper?.className).toContain('inset-0')
    expect(wrapper?.className).toContain('z-0')
    expect(wrapper?.className).toContain('pointer-events-none')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')

    // one gradient layer mounted inside for the crossfade
    const layers = wrapper?.querySelectorAll('.absolute.inset-0') ?? []
    expect(layers.length).toBeGreaterThanOrEqual(1)
  })

  it('renders exactly one layer per mounted theme', () => {
    const { container } = render(<BackgroundLayer theme="contact" />)
    const layers = container.querySelectorAll('.absolute.inset-0')
    expect(layers.length).toBe(1)
  })

  it('renders the current layer with the fade-in class', () => {
    const { container } = render(<BackgroundLayer theme="hero" />)
    const layer = container.querySelector('.background-fade-in')
    expect(layer).not.toBeNull()
  })

  it('quando il tema cambia mostra un layer in fade-in sopra quello vecchio', () => {
    const { container, rerender } = render(<BackgroundLayer theme="hero" />)
    act(() => {
      rerender(<BackgroundLayer theme="intro" />)
    })

    // due layer: il vecchio sfondo resta montato dietro (fading), il nuovo sopra (fade-in)
    const layers = container.querySelectorAll('.absolute.inset-0')
    expect(layers.length).toBe(2)

    // il layer dietro non ha il fade-in (già opaco), quello sopra sì
    expect(layers[0].className).not.toContain('background-fade-in')
    expect(layers[1].className).toContain('background-fade-in')
  })

  it('maps every section theme to a background defined in sectionThemes', () => {
    for (const key of Object.keys(sectionThemes)) {
      expect(sectionThemes[key as keyof typeof sectionThemes].background.length).toBeGreaterThan(0)
    }
  })
})