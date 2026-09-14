import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from '@/components/layout/app-shell'

// jsdom non implementa IntersectionObserver (usato da useActiveSection).
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeAll(() => {
  ;(global as { IntersectionObserver?: unknown }).IntersectionObserver =
    MockIntersectionObserver
})

describe('AppShell — focus tastiera', () => {
  it('marca main con data-input-focused al focus di un campo e lo rimuove al blur', () => {
    const { container } = render(
      <AppShell>
        <input aria-label="cerca" />
      </AppShell>,
    )
    const main = container.querySelector('main') as HTMLElement
    const input = screen.getByLabelText('cerca')

    expect(main).not.toHaveAttribute('data-input-focused')

    fireEvent.focusIn(input)
    expect(main).toHaveAttribute('data-input-focused', 'true')

    fireEvent.focusOut(input)
    expect(main).not.toHaveAttribute('data-input-focused')
  })

  it('azzera lo scroll orizzontale residuo su focus e blur', () => {
    const { container } = render(
      <AppShell>
        <input aria-label="cerca" />
      </AppShell>,
    )
    const main = container.querySelector('main') as HTMLElement
    const input = screen.getByLabelText('cerca')

    main.scrollLeft = 50
    fireEvent.focusIn(input)
    expect(main.scrollLeft).toBe(0)

    main.scrollLeft = 50
    fireEvent.focusOut(input)
    expect(main.scrollLeft).toBe(0)
  })

  it('non marca main quando il focus non è su un campo di testo', () => {
    const { container } = render(
      <AppShell>
        <button type="button">ok</button>
      </AppShell>,
    )
    const main = container.querySelector('main') as HTMLElement
    const button = screen.getByRole('button', { name: 'ok' })

    fireEvent.focusIn(button)
    expect(main).not.toHaveAttribute('data-input-focused')
  })

  it('main è contenuto orizzontalmente', () => {
    const { container } = render(
      <AppShell>
        <div />
      </AppShell>,
    )
    const main = container.querySelector('main') as HTMLElement
    expect(main.className).toContain('overflow-x-hidden')
    expect(main.className).toContain('overscroll-x-none')
  })
})
