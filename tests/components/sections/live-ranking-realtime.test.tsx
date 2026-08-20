import { render, screen, act } from '@testing-library/react'
import { LiveRankingSection } from '@/components/sections/live-ranking-section'
import { useVote } from '@/lib/VoteContext'

const mockT = (key: string, vars?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    'liveRanking.title': 'live ranking',
    'liveRanking.band.top20': 'TOP 20',
    'liveRanking.band.gold': 'GOLD',
    'liveRanking.band.silver': 'SILVER',
    'liveRanking.band.bronze': 'BRONZE',
    'liveRanking.bandCount': `${String(vars?.count)} companies`,
    'liveRanking.yourVote': 'your vote',
    'liveRanking.yourVotes': 'your votes',
    'liveRanking.pallets': `${String(vars?.count)} pallets`,
  }
  return map[key] ?? key
}

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: mockT }),
}))

jest.mock('@/lib/VoteContext', () => ({
  useVote: jest.fn(() => ({ gameUnlock: { success: false }, selectedCompanies: [] })),
}))

jest.mock('@/components/sponsor/sponsor-cards', () => ({ SponsorCards: () => null }))

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const mockHolder = {
  subscribeCb: null as ((status: string) => void) | null,
  changeCb: null as (() => void) | null,
  removeChannel: jest.fn(),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      // Solo il channel primario vote_sessions espone i callback controllabili;
      // quello del voting flag è un fake inerte (non deve sovrascrivere i handler).
      const isVote = name === 'live-ranking-votes'
      return {
        on: (_e: string, _o: unknown, cb: () => void) => {
          if (isVote) mockHolder.changeCb = cb
          return {
            subscribe: (cb2: (s: string) => void) => {
              if (isVote) mockHolder.subscribeCb = cb2
              return { unsubscribe: jest.fn() }
            },
          }
        },
        subscribe: (cb2: (s: string) => void) => {
          if (isVote) mockHolder.subscribeCb = cb2
          return { unsubscribe: jest.fn() }
        },
      }
    },
    removeChannel: mockHolder.removeChannel,
  }),
}))

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: (entries: Array<{ isIntersecting: boolean }>) => void
  constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = cb
    MockIntersectionObserver.instances.push(this)
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
}

function buildPayload(pallets: Array<[string, string, number]>) {
  return {
    companies: pallets.map(([id, name, total_pallets]) => ({
      id,
      name,
      image_url: null,
      total_pallets,
      vote_count: 1,
      rank: 0,
    })),
  }
}

const defaultPallets: Array<[string, string, number]> = [
  ['c01', 'Ceramiche X', 10],
  ['c02', 'Piastrelle Y', 9],
  ['c03', 'Gres Z', 8],
  ['c04', 'Marmo W', 1],
]

// 50 aziende con pallet decrescenti: c04 (979 pallet) è al rank 22 (GOLD).
function goldPallets(): Array<[string, string, number]> {
  const arr = Array.from({ length: 50 }, (_, i) => [`c${i}`, `Co ${i}`, 1000 - i] as [string, string, number])
  arr[21] = ['c04', 'Marmo W', 979]
  return arr
}

describe('LiveRankingSection realtime', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      return { ok: true, json: async () => buildPayload(defaultPallets) }
    })
    mockHolder.changeCb = null
    mockHolder.subscribeCb = null
    mockHolder.removeChannel.mockClear()
    MockIntersectionObserver.instances = []
    ;(global as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined })
    ;(useVote as jest.Mock).mockReturnValue({ gameUnlock: { success: false }, selectedCompanies: [] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('esegue l\'initial fetch al mount', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    expect(mockFetch).toHaveBeenCalledWith('/api/public/ranking')
    await screen.findByText('Ceramiche X')
  })

  it('refetch su evento vote_sessions (channel primario)', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    const callsBefore = mockFetch.mock.calls.length
    await act(async () => {
      mockHolder.changeCb?.()
      jest.advanceTimersByTime(600)
    })
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('il polling fallback è attivo solo quando il channel NON è connesso', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    const callsBefore = mockFetch.mock.calls.length
    await act(async () => { jest.advanceTimersByTime(30000) })
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)

    await act(async () => { mockHolder.subscribeCb?.('SUBSCRIBED') })
    const callsAfterSubscribe = mockFetch.mock.calls.length
    await act(async () => { jest.advanceTimersByTime(30000) })
    expect(mockFetch.mock.calls.length).toBe(callsAfterSubscribe)
  })

  it('sospende il channel fuori viewport e lo ristabilisce al rientro', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    expect(mockHolder.removeChannel).not.toHaveBeenCalled()
    await act(async () => { io.fire(false) })
    expect(mockHolder.removeChannel).toHaveBeenCalled()
    const callsBefore = mockFetch.mock.calls.length
    await act(async () => { io.fire(true) })
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(mockHolder.subscribeCb).not.toBeNull()
  })

  it('rispetta prefers-reduced-motion (stato finale renderizzato)', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    render(<LiveRankingSection />)
    expect(screen.getByText('live ranking')).toBeInTheDocument()
  })

  it('mostra il pulse sul badge della fascia chiusa al cambio di posizione', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: false },
      selectedCompanies: [{ company: { id: 'c04', name: 'Marmo W' }, pallet: 4 }],
    })
    let pallets = goldPallets()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      return { ok: true, json: async () => buildPayload(pallets) }
    })
    const { container } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })

    // Nessun pulse al caricamento iniziale (la firma inizializza solo il ref).
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull()

    // c04 scende da rank 22 a rank 21 (stessa fascia GOLD): firma cambia → pulse.
    pallets = goldPallets()
    pallets[20][2] = 978
    await act(async () => {
      mockHolder.changeCb?.()
      jest.advanceTimersByTime(600)
    })

    const badge = container.querySelector('[class*="animate-pulse"]')
    expect(badge).not.toBeNull()
  })

  it('sopprime il pulse con prefers-reduced-motion', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: false },
      selectedCompanies: [{ company: { id: 'c04', name: 'Marmo W' }, pallet: 4 }],
    })
    let pallets = goldPallets()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      return { ok: true, json: async () => buildPayload(pallets) }
    })
    const { container } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })

    // I dati sono renderizzati (le aziende caricate) prima di verificare l'assenza del pulse.
    await screen.findByText('Marmo W')

    // c04 scende da rank 22 a rank 21 (stessa fascia GOLD): firma cambia, ma
    // con prefers-reduced-motion il pulse NON deve apparire.
    pallets = goldPallets()
    pallets[20][2] = 978
    await act(async () => {
      mockHolder.changeCb?.()
      jest.advanceTimersByTime(600)
    })

    const badge = container.querySelector('[class*="animate-pulse"]')
    expect(badge).toBeNull()
  })
})