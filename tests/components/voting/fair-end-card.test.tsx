import { render, screen, waitFor } from '@testing-library/react'
import { FairEndCard } from '@/components/voting/fair-end-card'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? Object.values(p).join(' ') : k),
  }),
}))

const ceremony = { '1': '14:00', '2': '13:45', '3': '13:30' }

describe('FairEndCard', () => {
  it('fase A: titolo + countdown a durata piena (>24h mostrata in giorni)', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-25T00:00:00Z'))
    render(<FairEndCard phase="waiting" revealAt="2026-09-26T00:00:00Z" ceremony={ceremony} />)
    expect(screen.getByText('fairEnd.title')).toBeInTheDocument()
    expect(screen.getByText('1g 00:00:00')).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('fase A: countdown entro le 24h', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-25T00:00:00Z'))
    render(<FairEndCard phase="waiting" revealAt="2026-09-25T10:00:00Z" ceremony={ceremony} />)
    expect(screen.getByText('10:00:00')).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('fase B: mostra i primi 3 con punti e orari', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ companies: [
        { id: 'a', name: 'REFIN', total_pallets: 2156 },
        { id: 'b', name: 'MARINER', total_pallets: 2028 },
        { id: 'c', name: 'EURO', total_pallets: 971 },
      ] }),
    })) as unknown as typeof fetch
    render(<FairEndCard phase="final" revealAt={null} ceremony={ceremony} />)
    expect(await screen.findByText('1° REFIN')).toBeInTheDocument()
    expect(screen.getByText('2° MARINER')).toBeInTheDocument()
    expect(screen.getByText('3° EURO')).toBeInTheDocument()
    expect(screen.getByText('2156')).toBeInTheDocument()
    expect(screen.getByText('14:00')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })
})
