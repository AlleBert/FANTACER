import { render, screen } from '@testing-library/react'
import { LiquidFillButton } from '@/components/voting/liquid-fill-button'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

describe('LiquidFillButton', () => {
  const renderButton = (props: { step?: number; steps?: number; loading?: boolean }) =>
    render(
      <LiquidFillButton
        step={props.step ?? 0}
        steps={props.steps ?? 3}
        loading={props.loading}
        label="INVIA IL TUO VOTO"
        onClick={() => {}}
      />
    )

  it('renders the label text', () => {
    renderButton({})
    expect(screen.getByText('INVIA IL TUO VOTO')).toBeInTheDocument()
  })

  it('shows no progress counter in the label', () => {
    renderButton({ step: 1 })
    expect(screen.queryByText(/0\/3|1\/3|2\/3|3\/3/)).toBeNull()
  })

  it.each([[0], [1], [2]])('is disabled before 3 companies are voted (step %i)', (step) => {
    renderButton({ step })
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is enabled when 3 companies are voted', () => {
    renderButton({ step: 3 })
    expect(screen.getByRole('button')).toBeEnabled()
  })

  it('is disabled while loading even with 3 companies voted', () => {
    renderButton({ step: 3, loading: true })
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
