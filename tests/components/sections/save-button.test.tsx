import { act, fireEvent, render, screen } from '@testing-library/react'
import { toPng } from 'html-to-image'
import { SaveButton } from '@/components/sections/save-button'
import { sectionThemes } from '@/lib/section-themes'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

jest.mock('html-to-image', () => ({
  __esModule: true,
  toPng: jest.fn().mockResolvedValue('data:image/png;base64,'),
}))

afterEach(() => {
  jest.useRealTimers()
  document.body.innerHTML = ''
})

describe('SaveButton', () => {
  it('renderizza il bottone Salva', () => {
    const ref = { current: document.createElement('div') }
    render(<SaveButton containerRef={ref} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('cattura la <section> con lo sfondo del tema e le dimensioni del viewport', async () => {
    const section = document.createElement('section')
    section.setAttribute('data-section', 'success')
    const inner = document.createElement('div')
    section.appendChild(inner)
    document.body.appendChild(section)
    Object.defineProperty(section, 'clientWidth', { value: 1280, configurable: true })
    Object.defineProperty(section, 'clientHeight', { value: 800, configurable: true })

    const ref = { current: inner }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})

    expect(toPng).toHaveBeenCalledWith(
      section,
      expect.objectContaining({
        pixelRatio: 1,
        width: 1280,
        height: 800,
        cacheBust: false,
        style: { background: sectionThemes.success.background },
      })
    )
    document.body.removeChild(section)
  })

  it('risolve le dimensioni sponsor prima della cattura e le ripristina dopo', async () => {
    const section = document.createElement('section')
    section.setAttribute('data-section', 'success')
    const inner = document.createElement('div')
    const sponsorCard = document.createElement('div')
    sponsorCard.setAttribute(
      'style',
      '--sponsor-size: 7rem; --sponsor-scale: 1; width: calc(var(--sponsor-size) * var(--sponsor-scale));'
    )
    inner.appendChild(sponsorCard)
    section.appendChild(inner)
    document.body.appendChild(section)
    Object.defineProperty(section, 'clientWidth', { value: 1280, configurable: true })
    Object.defineProperty(section, 'clientHeight', { value: 800, configurable: true })

    // jsdom non fa layout: simuliamo getComputedStyle che risolve i calc in px.
    const origGetComputedStyle = window.getComputedStyle
    window.getComputedStyle = jest.fn((node: Element) => {
      if (node === sponsorCard) {
        return {
          getPropertyValue: (prop: string) => {
            if (prop === 'width') return '112px'
            return ''
          },
        } as CSSStyleDeclaration
      }
      return origGetComputedStyle(node)
    }) as typeof window.getComputedStyle

    const ref = { current: inner }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})

    // Dopo la cattura l'attributo style è stato ripristinato all'originale.
    expect(sponsorCard.getAttribute('style')).toBe(
      '--sponsor-size: 7rem; --sponsor-scale: 1; width: calc(var(--sponsor-size) * var(--sponsor-scale));'
    )
    window.getComputedStyle = origGetComputedStyle
    document.body.removeChild(section)
  })

  it('mostra Salvato! per 3s dopo il click', async () => {
    jest.useFakeTimers()
    const section = document.createElement('section')
    section.setAttribute('data-section', 'success')
    const inner = document.createElement('div')
    section.appendChild(inner)
    document.body.appendChild(section)
    Object.defineProperty(section, 'clientWidth', { value: 1280, configurable: true })
    Object.defineProperty(section, 'clientHeight', { value: 800, configurable: true })

    const ref = { current: inner }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(screen.getByText('success.saveDone')).toBeTruthy()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.getByText('success.saveCta')).toBeTruthy()
    document.body.removeChild(section)
  })
})