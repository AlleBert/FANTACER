import { render, screen, act } from '@testing-library/react'
import { RealtimeProvider, useRankingTick, useRealtime } from '@/lib/RealtimeContext'

type FakeChannel = {
  onHandler?: () => void
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
        on: (_e: string, _o: unknown, cb: () => void) => {
          mockChannels[name].onHandler = cb
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

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

function Probe({ enabled = true }: { enabled?: boolean }) {
  const { votingEnabled, rankingVersion, realtimeActive, visible } = useRealtime()
  useRankingTick(enabled)
  return (
    <div data-testid="state">
      {JSON.stringify({ votingEnabled, rankingVersion, realtimeActive, visible })}
    </div>
  )
}

function state() {
  return JSON.parse(screen.getByTestId('state').textContent || '{}') as {
    votingEnabled: boolean
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
    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ enabled: true }) }))
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
    expect(mockFetch).toHaveBeenCalledWith('/api/public/flag/voting')
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
      mockChannels['realtime-voting-flag'].onHandler?.()
    })
    expect(state().votingEnabled).toBe(false)
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
      mockChannels['realtime-ranking-tick'].onHandler?.()
      jest.advanceTimersByTime(500)
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
