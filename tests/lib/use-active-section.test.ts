import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useActiveSection } from '@/lib/use-active-section'

type IOCallback = (entries: IntersectionObserverEntry[]) => void

interface MockIO {
  observe: jest.Mock
  disconnect: jest.Mock
  trigger: (entries: Array<{ target: HTMLElement; ratio: number; isIntersecting?: boolean }>) => void
}

// Controllable IntersectionObserver mock.
let mockIO: MockIO | null = null

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: ReadonlyArray<number> = []

  observe = jest.fn()
  disconnect = jest.fn()
  takeRecords = jest.fn((): IntersectionObserverEntry[] => [])
  unobserve = jest.fn()

  private callback: IOCallback

  constructor(callback: IOCallback) {
    this.callback = callback
    mockIO = {
      observe: this.observe,
      disconnect: this.disconnect,
      trigger: (entries) => {
        const mapped: IntersectionObserverEntry[] = entries.map((e) => ({
          target: e.target,
          isIntersecting: e.isIntersecting ?? e.ratio > 0,
          intersectionRatio: e.ratio,
          boundingClientRect: new DOMRect(),
          intersectionRect: new DOMRect(),
          rootBounds: null,
          time: performance.now(),
        }))
        act(() => this.callback(mapped))
      },
    }
  }
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  // jsdom does not implement DOMRect
  class FakeDOMRect {
    x = 0
    y = 0
    width = 0
    height = 0
    top = 0
    right = 0
    bottom = 0
    left = 0
    toJSON() {
      return {}
    }
  }
  if (!global.DOMRect) {
    global.DOMRect = FakeDOMRect as unknown as typeof DOMRect
  }
})

afterAll(() => {
  delete (global as Record<string, unknown>).IntersectionObserver
})

function sectionsHtml(ids: string[]) {
  return ids.map((id) => `<section data-section="${id}">${id}</section>`).join('')
}

function setup(ids: string[]) {
  const holder = document.createElement('div')
  holder.innerHTML = sectionsHtml(ids)
  document.body.appendChild(holder)

  const harness = renderHook(() => {
    const ref = useRef<HTMLElement | null>(holder)
    return useActiveSection(ref)
  })

  return { holder, harness }
}

describe('useActiveSection', () => {
  beforeEach(() => {
    mockIO = null
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('starts with the section having the highest initial ratio', () => {
    const { holder, harness } = setup(['hero', 'intro'])
    const trigger = mockIO!.trigger
    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 1 },
      { target: holder.children[1] as HTMLElement, ratio: 0 },
    ])
    expect(harness.result.current).toBe('hero')
  })

  it('switches active section when the dominant section changes', () => {
    const { holder, harness } = setup(['hero', 'intro'])
    const trigger = mockIO!.trigger
    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 1 },
      { target: holder.children[1] as HTMLElement, ratio: 0 },
    ])
    expect(harness.result.current).toBe('hero')

    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 0.1 },
      { target: holder.children[1] as HTMLElement, ratio: 0.9 },
    ])
    expect(harness.result.current).toBe('intro')
  })

  it('observes and activates a dynamically added success section', () => {
    const { holder, harness } = setup(['hero'])
    const trigger = mockIO!.trigger
    trigger([{ target: holder.children[0] as HTMLElement, ratio: 1 }])
    expect(harness.result.current).toBe('hero')

    // simulate the conditional SuccessSection mounting
    act(() => {
      holder.insertAdjacentHTML('beforeend', '<section data-section="success">success</section>')
    })

    // MutationObserver re-observes; the new IO instance triggers the dominant section
    const reobservedTarget = holder.querySelector('[data-section="success"]') as HTMLElement
    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 0 },
      { target: reobservedTarget, ratio: 1 },
    ])
    expect(harness.result.current).toBe('success')
  })

  it('keeps previous active when a non-dominant section is removed', () => {
    const { holder, harness } = setup(['hero', 'intro', 'success'])
    const trigger = mockIO!.trigger
    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 0.6 },
      { target: holder.children[1] as HTMLElement, ratio: 0.4 },
      { target: holder.children[2] as HTMLElement, ratio: 0 },
    ])
    expect(harness.result.current).toBe('hero')

    act(() => {
      holder.children[2].remove()
    })

    // ratios for 'success' reset to 0 on re-observe
    trigger([
      { target: holder.children[0] as HTMLElement, ratio: 0.6 },
      { target: holder.children[1] as HTMLElement, ratio: 0.4 },
    ])
    expect(harness.result.current).toBe('hero')
  })

  it('disconnects observers on unmount', () => {
    const { harness } = setup(['hero'])
    expect(mockIO).not.toBeNull()
    harness.unmount()
    expect(mockIO!.disconnect).toHaveBeenCalled()
  })
})
