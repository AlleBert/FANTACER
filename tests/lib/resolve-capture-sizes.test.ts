import { resolveCustomPropertySizes } from '@/lib/resolve-capture-sizes'

describe('resolveCustomPropertySizes', () => {
  let origGetComputedStyle: typeof window.getComputedStyle

  beforeEach(() => {
    origGetComputedStyle = window.getComputedStyle
  })

  afterEach(() => {
    window.getComputedStyle = origGetComputedStyle
    document.body.innerHTML = ''
  })

  it('risolve in px le dimensioni basate su --sponsor-size e ripristina l\'originale', () => {
    const el = document.createElement('div')
    el.setAttribute(
      'style',
      '--sponsor-size: 7rem; --sponsor-scale: 1; width: calc(var(--sponsor-size) * var(--sponsor-scale)); height: calc(var(--sponsor-size) * var(--sponsor-scale));'
    )
    document.body.appendChild(el)

    // jsdom non fa layout: simuliamo il getComputedStyle reale del browser che
    // risolve i calc in px per l'elemento target.
    window.getComputedStyle = jest.fn((node: Element) => {
      if (node === el) {
        return {
          getPropertyValue: (prop: string) => {
            if (prop === 'width') return '112px'
            if (prop === 'height') return '112px'
            if (prop === 'flex-basis') return '112px'
            if (prop === 'max-width') return '112px'
            if (prop === 'max-height') return '112px'
            return ''
          },
        } as CSSStyleDeclaration
      }
      return origGetComputedStyle(node)
    })

    const restore = resolveCustomPropertySizes(document.body)
    const elNow = el.getAttribute('style') as string
    // Le custom property restano (per altre regole), ma le dimensioni diventano px
    expect(elNow).toContain('width: 112px')
    expect(elNow).toContain('height: 112px')
    expect(elNow).toContain('flex-basis: 112px')
    expect(elNow).toContain('max-width: 112px')
    expect(elNow).toContain('max-height: 112px')

    restore()
    expect(el.getAttribute('style')).toBe(
      '--sponsor-size: 7rem; --sponsor-scale: 1; width: calc(var(--sponsor-size) * var(--sponsor-scale)); height: calc(var(--sponsor-size) * var(--sponsor-scale));'
    )
  })

  it('non modifica nulla senza elementi target', () => {
    document.body.innerHTML = '<div>niente sponsor</div>'
    const restore = resolveCustomPropertySizes(document.body)
    expect(document.body.innerHTML).toBe('<div>niente sponsor</div>')
    restore()
  })
})