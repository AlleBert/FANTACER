import { render } from '@testing-library/react'
import { BackgroundLayer } from '@/components/layout/background-layer'
import { sectionThemes } from '@/lib/section-themes'

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

    // one gradient layer (keyed by theme) mounted inside for crossfade
    const layers = wrapper?.querySelectorAll('.absolute.inset-0') ?? []
    expect(layers.length).toBeGreaterThanOrEqual(1)
  })

  it('renders exactly one layer per mounted theme', () => {
    const { container } = render(<BackgroundLayer theme="contact" />)
    const layers = container.querySelectorAll('.absolute.inset-0')
    expect(layers.length).toBe(1)
  })

  it('maps every section theme to a background defined in sectionThemes', () => {
    for (const key of Object.keys(sectionThemes)) {
      expect(sectionThemes[key as keyof typeof sectionThemes].background.length).toBeGreaterThan(0)
    }
  })
})
