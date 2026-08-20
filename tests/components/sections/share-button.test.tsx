import { act, fireEvent, render, screen } from '@testing-library/react'
import { ShareButton } from '@/components/sections/share-button'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

afterEach(() => {
  jest.useRealTimers()
  delete (navigator as { share?: unknown }).share
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe('ShareButton', () => {
  it('usa navigator.share se disponibile', async () => {
    const share = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: share })
    render(<ShareButton text="ciao @fanta.cer" url="https://x" />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(share).toHaveBeenCalledWith({ text: 'ciao @fanta.cer', url: 'https://x' })
  })

  it('fallback a clipboard e mostra Copiato! per 3s', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText } })
    jest.useFakeTimers()
    render(<ShareButton text="ciao" url="https://x" />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(writeText).toHaveBeenCalledWith('ciao https://x')
    expect(screen.getByText('success.shareCopied')).toBeTruthy()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.getByText('success.shareButton')).toBeTruthy()
  })
})
