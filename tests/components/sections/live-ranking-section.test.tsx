import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

// Il componente ricalcola i rank lato client via `rankCompanies` (sort per
// total_pallets desc). Il payload deve quindi essere coerente con quel sort:
// 333 aziende con pallet decrescenti fanno sì che le aziende "nominate" cadano
// nelle fasce desiderate (rank 1, 21, 22, 51, 101).
function makePayload() {
  const companies = Array.from({ length: 333 }, (_, i) => ({
    id: `f${i}`,
    name: `Filler ${i}`,
    image_url: null,
    total_pallets: 1000 - i,
    vote_count: 1,
  }))
  const set = (rank: number, id: string, name: string) => {
    companies[rank - 1] = { ...companies[rank - 1], id, name }
  }
  set(1, 'c01', 'Ceramiche X')
  set(2, 'c02', 'Piastrelle Y')
  set(3, 'c03', 'Gres Z')
  set(21, 'c04', 'Marmo W')
  set(22, 'c05', 'Porcellanato V')
  set(23, 'c08', 'Extra GOLD')
  set(51, 'c06', 'Bioceramic R')
  set(101, 'c07', 'Klinker T')
  return { companies }
}

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const mockHolder = {
  subscribeCb: null as ((status: string) => void) | null,
  changeCb: null as (() => void) | null,
  removeChannel: jest.fn(),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => ({
      on: (_e: string, _o: unknown, cb: () => void) => {
        if (name === 'live-ranking-votes') mockHolder.changeCb = cb
        return {
          subscribe: (cb2: (s: string) => void) => {
            if (name === 'live-ranking-votes') mockHolder.subscribeCb = cb2
            return { unsubscribe: jest.fn() }
          },
        }
      },
      subscribe: (cb2: (s: string) => void) => {
        if (name === 'live-ranking-votes') mockHolder.subscribeCb = cb2
        return { unsubscribe: jest.fn() }
      },
    }),
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

describe('LiveRankingSection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockHolder.subscribeCb = null
    mockHolder.changeCb = null
    mockHolder.removeChannel.mockClear()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      return { ok: true, json: async () => makePayload() }
    })
    ;(useVote as jest.Mock).mockReturnValue({ gameUnlock: { success: false }, selectedCompanies: [] })
  })

  it('mostra la TOP 20 aperta con i punteggi', async () => {
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.getByText('1000 pallets')).toBeInTheDocument()
  })

  it('GOLD/SILVER/BRONZE sono chiuse di default e non mostrano punteggi', async () => {
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.queryByText('Marmo W')).not.toBeInTheDocument()
    expect(screen.getByText(/GOLD/)).toBeInTheDocument()
  })

  it("apre la fascia al click sull'header", async () => {
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    fireEvent.click(screen.getByText(/GOLD/))
    await waitFor(() => {
      expect(screen.getByText('Marmo W')).toBeInTheDocument()
    })
  })

  it('con 1 voto nella fascia mostra posizione e nome', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: true },
      selectedCompanies: [
        { company: { id: 'c04', name: 'Marmo W' }, pallet: 4 },
      ],
    })
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.getByText('#21')).toBeInTheDocument()
    expect(screen.getByText('Marmo W')).toBeInTheDocument()
  })

  it('con 2 voti nella stessa fascia mostra il badge con conteggio e posizioni', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: true },
      selectedCompanies: [
        { company: { id: 'c04', name: 'Marmo W' }, pallet: 4 },
        { company: { id: 'c05', name: 'Porcellanato V' }, pallet: 2 },
      ],
    })
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.getByText('2 · #21 #22')).toBeInTheDocument()
  })

  it('con 3 voti nella stessa fascia mostra il badge corto su mobile', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: true },
      selectedCompanies: [
        { company: { id: 'c04', name: 'Marmo W' }, pallet: 4 },
        { company: { id: 'c05', name: 'Porcellanato V' }, pallet: 2 },
        { company: { id: 'c08', name: 'Extra GOLD' }, pallet: 1 },
      ],
    })
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.getByText('3 · your votes')).toBeInTheDocument()
  })

  it('non rende alcuna CTA lead-gen', async () => {
    render(<LiveRankingSection />)
    await screen.findByText('Ceramiche X')
    expect(screen.queryByText(/classifica completa/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/full ranking/i)).not.toBeInTheDocument()
  })

  it('con voto disattivato non renderizza la sezione', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: false }) }
      }
      return { ok: true, json: async () => makePayload() }
    })
    const { container } = render(<LiveRankingSection />)
    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull()
    })
  })
})

describe('LiveRankingSection — stato accordion al refetch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    MockIntersectionObserver.instances = []
    mockHolder.changeCb = null
    mockHolder.subscribeCb = null
    ;(global as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as { IntersectionObserver: unknown }).IntersectionObserver = undefined
  })

  it('preserva lo stato aperto/chiuso delle fasce quando i dati vengono aggiornati', async () => {
    let payload = makePayload()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: true }) }
      }
      return { ok: true, json: async () => payload }
    })

    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })

    // TOP20 aperta di default, GOLD chiusa
    expect(screen.getByRole('button', { name: /GOLD/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /TOP 20/ })).toHaveAttribute('aria-expanded', 'true')

    // apri la fascia GOLD
    fireEvent.click(screen.getByRole('button', { name: /GOLD/ }))
    expect(screen.getByRole('button', { name: /GOLD/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Marmo W')).toBeInTheDocument()

    // nuovo dataset: aziende diverse, sempre con una fascia GOLD
    payload = makePayload()
    payload.companies[0] = { ...payload.companies[0], id: 'n01', name: 'Nuova Ceramiche' }
    payload.companies[20] = { ...payload.companies[20], id: 'n02', name: 'Nuova GOLD' }
    payload.companies[21] = { ...payload.companies[21], id: 'n03', name: 'Nuova GOLD 2' }

    // refetch via evento realtime (dopo il debounce di 500ms)
    await act(async () => {
      mockHolder.changeCb?.()
      jest.advanceTimersByTime(600)
    })

    // lo stato è preservato: GOLD resta aperta, SILVER/BRONZE restano chiuse
    expect(screen.getByRole('button', { name: /GOLD/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /SILVER/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /BRONZE/ })).toHaveAttribute('aria-expanded', 'false')

    // i nuovi dati sono renderizzati nelle fasce corrispondenti
    expect(screen.getByText('Nuova Ceramiche')).toBeInTheDocument()
    expect(screen.getByText('Nuova GOLD')).toBeInTheDocument()
    expect(screen.queryByText('Marmo W')).not.toBeInTheDocument()
  })
})
