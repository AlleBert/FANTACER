import { act, render, screen } from '@testing-library/react'
import { ModalShell } from '@/components/ui/modal-shell'

describe('ModalShell', () => {
  it('rende il contenuto quando open', () => {
    render(
      <ModalShell open labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    expect(screen.getByText('contenuto')).toBeTruthy()
  })

  it('espone il ruolo dialog con aria-labelledby', () => {
    render(
      <ModalShell open labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 't')
  })

  it('nasconde il dialog quando chiuso e non visibile', () => {
    render(
      <ModalShell open={false} labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('preserva il fade-out: il dialog resta nel DOM subito dopo la chiusura', () => {
    const { rerender } = render(
      <ModalShell open labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    rerender(
      <ModalShell open={false} labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
  })

  it('nasconde completamente dopo il delay di exit (220ms)', () => {
    jest.useFakeTimers()
    const { rerender } = render(
      <ModalShell open labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    rerender(
      <ModalShell open={false} labelledBy="t">
        <p>contenuto</p>
      </ModalShell>
    )
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    jest.useRealTimers()
  })
})