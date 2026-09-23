import { render, screen, act } from '@testing-library/react'
import {
  RealtimeProvider,
  useRankingTick,
  useRealtime,
  RANKING_DEBOUNCE_MS,
  RANKING_DEBOUNCE_JITTER_MS,
} from '@/lib/RealtimeContext'

type FakeChannel = {
  onHandlers?: Array<{ filter: string; cb: () => void }>
  subscribeCb?: (status: string) => void
  subscribed?: boolean
}

const mockChannels: Record<string, FakeChannel> = {}
const mockRemoveChannel = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      mockChannels[name] = mockChannels[name] ?? {}
      const ch = {
        on: (_e: string, opts: { filter?: string }, cb: () => void) => {
          mockChannels[name].onHandlers = mockChannels[name].onHandlers ?? []
          mockChannels[name].onHandlers!.push({ filter: opts?.filter ?? '', cb })
          return ch
        },
        subscribe: (cb: (status: string) => void) => {
          mockChannels[name].subscribed = true
          mockChannels[name].subscribeCb = cb
          return ch
        },
      }
      return ch
    },
    removeChannel: mockRemoveChannel,
  }),
}))

/** Invoca i listener del canale il cui filtro contiene `needle`. */
function emit(channel: string, needle: string) {
  for (const h of mockChannels[channel]?.onHandlers ?? []) {
    if (h.filter.includes(needle)) h.cb()
  }
}

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

function Probe({ enabled = true }: { enabled?: boolean }) {
  const { votingEnabled, antibotEnabled, rankingVersion, realtimeActive, visible } = useRealtime()
  useRankingTick(enabled)
  return (
    <div data-testid="state">
      {JSON.stringify({ votingEnabled, antibotEnabled, rankingVersion, realtimeActive, visible })}
    </div>
  )
}

function state() {
  return JSON.parse(screen.getByTestId('state').textContent || '{}') as {
    votingEnabled: boolean
    antibotEnabled: boolean
    rankingVersion: number
    realtimeActive: boolean
    visible: boolean
  }
}

let hidden = false
function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    for (const k of Object.keys(mockChannels)) delete mockChannels[k]
    mockRemoveChannel.mockClear()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({ enabled: !String(url).includes('antibot') }),
    }))
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sottoscrive un solo canale flag e carica votingEnabled', async () => {
    render(
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>,
    )
    await act(async () => {})
    expect(mockChannels['realtime-voting-flag']).toBeDefined()
    expect(mockChannels['realtime-voting-flag'].subscribed).toBe(true)
    expect(state().votingEnabled).toBe(true)
    expect(state().antibotEnabled).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith('/api/public/flag/voting')
    expect(mockFetch).toHaveBeenCalledWith('/api/public/flag/antibot')
    expect(mockFetch).toHaveBeenCalledWith('/api/public/flag/fair-end')
    // quattro listener sullo stesso canale: voting_enabled + antibot_enabled + fair_end_enabled + fair_end_config
    expect(mockChannels['realtime-voting-flag'].onHandlers).toHaveLength(4)
  })

  it('su UPDATE del flag ri-fetcha voting_enabled', async () => {
    render(
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>,
    )
    await act(async () => {})

    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ enabled: false }) }))
    await act(async () => {
      emit('realtime-voting-flag', 'voting_enabled')
    })
    expect(state().votingEnabled).toBe(false)
  })

  it('su UPDATE di antibot_enabled attiva il blocco', async () => {
    render(
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>,
    )
    await act(async () => {})
    expect(state().antibotEnabled).toBe(false)

    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ enabled: true }) }))
    await act(async () => {
      emit('realtime-voting-flag', 'antibot_enabled')
    })
    expect(state().antibotEnabled).toBe(true)
  })

  it('apre il canale ranking con un consumer e incrementa la versione su evento (debounced)', async () => {
    render(
      <RealtimeProvider>
        <Probe enabled />
      </RealtimeProvider>,
    )
    await act(async () => {})
    expect(mockChannels['realtime-ranking-tick']).toBeDefined()
    expect(state().rankingVersion).toBe(0)

    await act(async () => {
      emit('realtime-ranking-tick', '')
      jest.advanceTimersByTime(RANKING_DEBOUNCE_MS + RANKING_DEBOUNCE_JITTER_MS)
    })
    expect(state().rankingVersion).toBe(1)
    expect(state().realtimeActive).toBe(true)
  })

  it('non apre il canale ranking senza consumer', async () => {
    render(
      <RealtimeProvider>
        <Probe enabled={false} />
      </RealtimeProvider>,
    )
    await act(async () => {})
    expect(mockChannels['realtime-ranking-tick']).toBeUndefined()
  })

  it('chiude i canali quando la scheda va in background e li riapre al ritorno', async () => {
    render(
      <RealtimeProvider>
        <Probe enabled />
      </RealtimeProvider>,
    )
    await act(async () => {})

    await act(async () => { setHidden(true) })
    expect(state().visible).toBe(false)
    expect(mockRemoveChannel).toHaveBeenCalled()

    const calls = mockFetch.mock.calls.length
    await act(async () => { setHidden(false) })
    expect(state().visible).toBe(true)
    // catch-up del flag al ritorno visibile
    expect(mockFetch.mock.calls.length).toBeGreaterThan(calls)
    expect(mockChannels['realtime-voting-flag']).toBeDefined()
    expect(mockChannels['realtime-ranking-tick']).toBeDefined()
  })
})
