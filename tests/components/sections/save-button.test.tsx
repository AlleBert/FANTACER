import { act, fireEvent, render, screen } from '@testing-library/react'
import html2canvas from 'html2canvas'
import { SaveButton } from '@/components/sections/save-button'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,'),
  }),
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

  it('chiama html2canvas e scarica il PNG', async () => {
    const ref = { current: document.createElement('div') }
    render(<SaveButton containerRef={ref} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(html2canvas).toHaveBeenCalledWith(ref.current, expect.any(Object))
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
