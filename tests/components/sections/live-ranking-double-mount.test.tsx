import { render, act } from '@testing-library/react'
import { LiveRankingSection } from '@/components/sections/live-ranking-section'
import { RealtimeProvider } from '@/lib/RealtimeContext'
import { useVote } from '@/lib/VoteContext'

const mockT = (key: string) => key

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: mockT }),
}))

jest.mock('@/lib/VoteContext', () => ({
  useVote: jest.fn(() => ({ gameUnlock: { success: false }, selectedCompanies: [] })),
}))

jest.mock('@/components/sponsor/sponsor-cards', () => ({ SponsorCards: () => null }))

// Il client reale (createBrowserClient) è un singleton e RealtimeClient.channel()
// deduplica per topic: una seconda chiamata con lo stesso nome restituisce lo
// STESSO canale già joinato, su cui `.on()` lancia:
//   "cannot add `postgres_changes` callbacks for realtime:<topic> after `subscribe()`."
// Il RealtimeProvider centralizza i canali e condivide il topic fra i consumer;
// questo mock verifica che NON si registri due volte lo stesso topic.
const channels = new Map<string, Record<string, unknown>>()
const onCallCount = new Map<string, number>()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      if (!channels.has(name)) {
        const ch: Record<string, unknown> = { joined: false }
        ch.on = () => {
          if (ch.joined) {
            throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${name} after \`subscribe()\`.`)
          }
          onCallCount.set(name, (onCallCount.get(name) ?? 0) + 1)
          return ch
        }
        ch.subscribe = (cb?: (s: string) => void) => {
          ch.joined = true
          cb?.('SUBSCRIBED')
          return { unsubscribe: jest.fn() }
        }
        channels.set(name, ch)
      }
      return channels.get(name)!
    },
    removeChannel: jest.fn(),
  }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('RealtimeProvider + consumatori — canale condiviso', () => {
  beforeEach(() => {
    channels.clear()
    onCallCount.clear()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ companies: [], enabled: false }) }))
    ;(useVote as jest.Mock).mockReturnValue({ gameUnlock: { success: false }, selectedCompanies: [] })
  })

  it('due consumatori condividono lo stesso topic senza doppio `on` (nessun throw)', async () => {
    expect(() =>
      render(
        <RealtimeProvider>
          <LiveRankingSection showWhenDisabled />
          <LiveRankingSection showWhenDisabled />
        </RealtimeProvider>,
      ),
    ).not.toThrow()
    await act(async () => {})

    // il topic dei flag resta uno solo (voting_enabled + antibot_enabled +
    // fair_end_enabled + fair_end_config), non uno per consumer: nessun doppio
    // `on` per lo stesso filtro.
    expect(onCallCount.get('realtime-voting-flag')).toBe(4)
  })
})
