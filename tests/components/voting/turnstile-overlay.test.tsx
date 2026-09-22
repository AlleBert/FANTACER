import { render, screen, fireEvent } from '@testing-library/react'
import { TurnstileOverlay } from '@/components/voting/turnstile-overlay'

jest.mock('@marsidev/react-turnstile', () => ({
  Turnstile: (props: {
    options?: { action?: string }
    onError?: () => void
    onExpire?: () => void
  }) => {
    const w = window as unknown as { __tsRenders?: number }
    w.__tsRenders = (w.__tsRenders ?? 0) + 1
    return (
      <button
        data-testid="ts"
        data-action={props.options?.action}
        onClick={() => props.onError?.()}
        onContextMenu={(e) => {
          e.preventDefault()
          props.onExpire?.()
        }}
      >
        ts
      </button>
    )
  },
}))

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

jest.mock('@/lib/use-scroll-lock', () => ({ useScrollLock: () => {} }))

function renders(): number {
  return (window as unknown as { __tsRenders?: number }).__tsRenders ?? 0
}

beforeEach(() => {
  ;(window as unknown as { __tsRenders?: number }).__tsRenders = 0
})

describe('TurnstileOverlay', () => {
  it('passa action "vote" al widget', () => {
    render(
      <TurnstileOverlay isVisible onClose={() => {}} onSuccess={() => {}} onError={() => {}} />,
    )
    expect(screen.getByTestId('ts').getAttribute('data-action')).toBe('vote')
  })

  it('su errore rimonta il widget (nuovo challenge/token) e propaga onError', () => {
    const onError = jest.fn()
    render(
      <TurnstileOverlay isVisible onClose={() => {}} onSuccess={() => {}} onError={onError} />,
    )
    const before = renders()
    fireEvent.click(screen.getByTestId('ts'))
    expect(onError).toHaveBeenCalledWith('turnstile.error')
    expect(renders()).toBeGreaterThan(before)
    expect(screen.getByTestId('ts')).toBeInTheDocument()
  })

  it('su expire rimonta il widget', () => {
    render(
      <TurnstileOverlay isVisible onClose={() => {}} onSuccess={() => {}} onError={() => {}} />,
    )
    const before = renders()
    fireEvent.contextMenu(screen.getByTestId('ts'))
    expect(renders()).toBeGreaterThan(before)
  })
})
