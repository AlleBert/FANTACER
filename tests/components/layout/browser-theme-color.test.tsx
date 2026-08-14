import { render } from '@testing-library/react'
import { BrowserThemeColor } from '@/components/layout/browser-theme-color'
import { sectionThemes } from '@/lib/section-themes'

const META_SELECTOR = 'meta[name="theme-color"]'

function getMetaContent(): string | null {
  return document.querySelector<HTMLMetaElement>(META_SELECTOR)?.content ?? null
}

function setMetaContent(value: string) {
  let meta = document.querySelector<HTMLMetaElement>(META_SELECTOR)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.content = value
}

describe('BrowserThemeColor', () => {
  beforeEach(() => {
    document.querySelectorAll(META_SELECTOR).forEach((el) => el.remove())
  })

  it('renders nothing (no DOM output of its own)', () => {
    const { container } = render(<BrowserThemeColor theme="hero" />)
    expect(container.firstChild).toBeNull()
  })

  it('updates the theme-color meta to the active section themeColor', () => {
    setMetaContent('#000000')
    render(<BrowserThemeColor theme="hero" />)
    expect(getMetaContent()).toBe(sectionThemes.hero.themeColor)
  })

  it('creates the meta tag if missing and sets the theme color', () => {
    render(<BrowserThemeColor theme="intro" />)
    expect(getMetaContent()).toBe(sectionThemes.intro.themeColor)
  })

  it('updates the meta when activeSection changes to another theme', () => {
    const { rerender } = render(<BrowserThemeColor theme="hero" />)
    expect(getMetaContent()).toBe(sectionThemes.hero.themeColor)

    rerender(<BrowserThemeColor theme="contact" />)
    expect(getMetaContent()).toBe(sectionThemes.contact.themeColor)

    rerender(<BrowserThemeColor theme="search" />)
    expect(getMetaContent()).toBe(sectionThemes.search.themeColor)
  })

  it('does not touch the meta when theme is null (initial state)', () => {
    setMetaContent('#000000')
    render(<BrowserThemeColor theme={null} />)
    expect(getMetaContent()).toBe('#000000')
  })
})
