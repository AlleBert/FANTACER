import { act, fireEvent, render, screen } from '@testing-library/react'
import { toPng } from 'html-to-image'
import { SaveButton } from '@/components/sections/save-button'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

jest.mock('html-to-image', () => ({
  __esModule: true,
  toPng: jest.fn().mockResolvedValue('data:image/png;base64,'),
}))

afterEach(() => {
  jest.useRealTimers()
})

describe('SaveButton', () => {
  it('renderizza il bottone Salva', () => {
    const ref = { current: document.createElement('div') }
    render(<SaveButton containerRef={ref} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('chiama toPng e scarica il PNG', async () => {
    const ref = { current: document.createElement('div') }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(toPng).toHaveBeenCalledWith(ref.current, expect.any(Object))
  })

  it('mostra Salvato! per 3s dopo il click', async () => {
    jest.useFakeTimers()
    const ref = { current: document.createElement('div') }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(screen.getByText('success.saveDone')).toBeTruthy()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.getByText('success.saveCta')).toBeTruthy()
  })
})
