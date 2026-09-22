import { render, screen, act } from '@testing-library/react'
import { LiveRankingSection, PALLETS_POLLING_MS } from '@/components/sections/live-ranking-section'
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

// Stato realtime controllabile dal test. `useRankingTick` è un no-op (la
// gestione dei canali è coperta dai test del RealtimeProvider).
const mockRealtime = {
  votingEnabled: true,
  votingEnabledLoaded: true,
  antibotEnabled: false,
  rankingVersion: 0,
  realtimeActive: false,
  visible: true,
  acquireRanking: jest.fn(() => jest.fn()),
}
const mockUseRankingTick = jest.fn()

jest.mock('@/lib/RealtimeContext', () => ({
  useRealtime: () => mockRealtime,
  useRankingTick: (enabled: boolean) => mockUseRankingTick(enabled),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

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

function rankingCalls() {
  return mockFetch.mock.calls.filter((c) => String(c[0]).includes('/api/public/ranking')).length
}

describe('LiveRankingSection realtime (via RealtimeProvider)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => buildPayload(defaultPallets) }))
    mockRealtime.votingEnabled = true
    mockRealtime.rankingVersion = 0
    mockRealtime.realtimeActive = false
    mockRealtime.visible = true
    mockUseRankingTick.mockClear()
    MockIntersectionObserver.instances = []
    ;(global as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined })
    ;(useVote as jest.Mock).mockReturnValue({ gameUnlock: { success: false }, selectedCompanies: [] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("esegue l'initial fetch al mount", async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    expect(mockFetch).toHaveBeenCalledWith('/api/public/ranking')
    await screen.findByText('Ceramiche X')
  })

  it("quando l'admin accende il voto, la classifica si monta senza reload", async () => {
    mockRealtime.votingEnabled = false
    const { container, rerender } = render(<LiveRankingSection />)
    await act(async () => {})

    // pre-fiera: sezione assente dal DOM (showWhenDisabled=false)
    expect(container.querySelector('section')).toBeNull()

    // l'admin accende voting_enabled: il provider aggiorna il contesto → sezione montata
    mockRealtime.votingEnabled = true
    rerender(<LiveRankingSection />)

    await screen.findByText('Ceramiche X')
    expect(container.querySelector('section')).not.toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('/api/public/ranking')
  })

  it('refetch su rankingVersion (evento ranking_tick dal provider)', async () => {
    const { rerender } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    const before = rankingCalls()

    mockRealtime.rankingVersion = 1
    rerender(<LiveRankingSection />)
    await act(async () => {})

    expect(rankingCalls()).toBeGreaterThan(before)
  })

  it('il polling fallback resta attivo finché non arriva un evento reale (RLS)', async () => {
    const { rerender } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    const before = rankingCalls()

    // realtimeActive=false → il polling 10s continua a rifetchare
    await act(async () => { jest.advanceTimersByTime(PALLETS_POLLING_MS) })
    const afterPoll = rankingCalls()
    expect(afterPoll).toBeGreaterThan(before)

    // arriva un evento reale → realtimeActive=true
    mockRealtime.rankingVersion = 1
    mockRealtime.realtimeActive = true
    rerender(<LiveRankingSection />)
    await act(async () => {})
    const afterEvent = rankingCalls()
    expect(afterEvent).toBeGreaterThan(afterPoll)

    // con realtimeActive=true il polling successivo NON aggiunge fetch
    await act(async () => { jest.advanceTimersByTime(PALLETS_POLLING_MS) })
    expect(rankingCalls()).toBe(afterEvent)
  })

  it('sospende polling fuori viewport e rifetcha al rientro', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    await act(async () => { io.fire(false) })
    const before = rankingCalls()

    // fuori viewport il polling non rifetcha
    await act(async () => { jest.advanceTimersByTime(PALLETS_POLLING_MS) })
    expect(rankingCalls()).toBe(before)

    // rientro in viewport → fetch
    await act(async () => { io.fire(true) })
    expect(rankingCalls()).toBeGreaterThan(before)
  })

  it('al ritorno in primo piano rifetcha (catch-up)', async () => {
    const { rerender } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })
    const before = rankingCalls()

    mockRealtime.visible = false
    rerender(<LiveRankingSection />)
    await act(async () => {})

    mockRealtime.visible = true
    rerender(<LiveRankingSection />)
    await act(async () => {})

    expect(rankingCalls()).toBeGreaterThan(before)
  })

  it('richiede il canale ranking solo quando è visibile e il voto è attivo', async () => {
    mockRealtime.votingEnabled = false
    const { rerender } = render(<LiveRankingSection />)
    await act(async () => {})
    expect(mockUseRankingTick).toHaveBeenLastCalledWith(false)

    mockRealtime.votingEnabled = true
    rerender(<LiveRankingSection />)
    await act(async () => {})
    expect(mockUseRankingTick).toHaveBeenLastCalledWith(true)
  })

  it('rispetta prefers-reduced-motion (stato finale renderizzato)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    render(<LiveRankingSection />)
    await act(async () => {})
    expect(screen.getByText('live ranking')).toBeInTheDocument()
  })

  it('mostra il pulse sul badge della fascia chiusa al cambio di posizione', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: true },
      selectedCompanies: [{ company: { id: 'c04', name: 'Marmo W' }, pallet: 4 }],
    })
    let pallets = goldPallets()
    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => buildPayload(pallets) }))
    const { container, rerender } = render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })

    // Nessun pulse al caricamento iniziale (la firma inizializza solo il ref).
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull()

    // c04 scende da rank 22 a rank 21 (stessa fascia GOLD): firma cambia → pulse.
    pallets = goldPallets()
    pallets[20][2] = 978
    mockRealtime.rankingVersion = 1
    rerender(<LiveRankingSection />)
    await act(async () => {})

    const badge = container.querySelector('[class*="animate-pulse"]')
    expect(badge).not.toBeNull()
  })

  it('non evidenzia le selezioni non confermate (success: false)', async () => {
    ;(useVote as jest.Mock).mockReturnValue({
      gameUnlock: { success: false },
      selectedCompanies: [{ company: { id: 'c04', name: 'Marmo W' }, pallet: 4 }],
    })
    render(<LiveRankingSection />)
    await act(async () => {})
    const io = MockIntersectionObserver.instances[0]
    await act(async () => { io.fire(true) })

    await screen.findAllByText('Marmo W')
    expect(screen.queryByText('your vote')).toBeNull()
  })
})
