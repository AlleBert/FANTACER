import { act, fireEvent, render, screen } from '@testing-library/react'
import { SaveButton } from '@/components/sections/save-button'
import type { SelectedCompany } from '@/lib/VoteContext'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'it' }),
}))

const COMPANIES: SelectedCompany[] = [
  { company: { id: 'a', name: 'Alpha' }, pallet: 4 },
  { company: { id: 'b', name: 'Beta' }, pallet: 2 },
  { company: { id: 'c', name: 'Gamma' }, pallet: 1 },
]

describe('SaveButton', () => {
  let fetchMock: jest.Mock
  let clickSpy: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['png'], { type: 'image/png' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // jsdom non implementa createObjectURL/revokeObjectURL
    URL.createObjectURL = jest.fn(() => 'blob:fake')
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    fetchMock.mockRestore()
    clickSpy.mockRestore()
  })

  it('renderizza il bottone Salva', () => {
    render(<SaveButton companies={COMPANIES} />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('chiama /api/share/vote con id aziende, pallet e locale', async () => {
    render(<SaveButton companies={COMPANIES} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = (fetchMock.mock.calls[0][0] as string) || ''
    expect(url).toMatch(/^\/api\/share\/vote\?/)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('c1')).toBe('a')
    expect(params.get('c2')).toBe('b')
    expect(params.get('c3')).toBe('c')
    expect(params.get('p1')).toBe('4')
    expect(params.get('p2')).toBe('2')
    expect(params.get('p3')).toBe('1')
    expect(params.get('lang')).toBe('it')
  })

  it('scarica il PNG e mostra Salvato! per 3s', async () => {
    jest.useFakeTimers()
    render(<SaveButton companies={COMPANIES} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('success.saveDone')).toBeTruthy()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.getByText('success.saveCta')).toBeTruthy()
  })

  it('mostra errore se la fetch fallisce', async () => {
    jest.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    render(<SaveButton companies={COMPANIES} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(screen.getByText('errore_salvataggio')).toBeTruthy()
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(screen.queryByText('errore_salvataggio')).toBeNull()
  })

  it('non fa nulla con meno di 3 aziende', async () => {
    render(<SaveButton companies={COMPANIES.slice(0, 2)} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
