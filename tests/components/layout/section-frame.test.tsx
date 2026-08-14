import { render, screen } from '@testing-library/react'
import { SectionFrame } from '@/components/layout/section-frame'

describe('SectionFrame', () => {
  it('renders the <section> element itself with data-section and no wrapper', () => {
    const { container } = render(<SectionFrame theme="hero">content</SectionFrame>)
    const section = container.querySelector('section')
    expect(section).not.toBeNull()
    expect(section).toHaveAttribute('data-section', 'hero')
    // section must be the top-level element (no extra wrapper breaking main > section)
    expect(container.firstElementChild?.tagName).toBe('SECTION')
    expect(container.firstElementChild).toBe(section)
  })

  it('uses snap-screen by default', () => {
    const { container } = render(<SectionFrame theme="intro">content</SectionFrame>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('snap-screen')
    expect(section?.className).not.toContain('snap-start')
  })

  it('uses snap-start + app-screen with grow', () => {
    const { container } = render(<SectionFrame theme="search" grow>content</SectionFrame>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('snap-start')
    expect(section?.className).toContain('app-screen')
    expect(section?.className).not.toContain('snap-screen')
  })

  it('forwards id (e.g. contact-section)', () => {
    const { container } = render(<SectionFrame theme="contact" id="contact-section">content</SectionFrame>)
    const section = container.querySelector('section')
    expect(section).toHaveAttribute('id', 'contact-section')
  })

  it('forwards className and renders children', () => {
    render(
      <SectionFrame theme="intro" className="text-white flex flex-col">
        <span>child</span>
      </SectionFrame>,
    )
    const section = screen.getByText('child').closest('section')
    expect(section?.className).toContain('text-white')
    expect(section?.className).toContain('flex')
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('always keeps relative w-full overflow-hidden structural classes', () => {
    const { container } = render(<SectionFrame theme="hero">content</SectionFrame>)
    const section = container.querySelector('section')
    expect(section?.className).toContain('relative')
    expect(section?.className).toContain('w-full')
    expect(section?.className).toContain('overflow-hidden')
  })
})
