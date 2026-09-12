import { render, act } from '@testing-library/react'
import { LiveRankingSection } from '@/components/sections/live-ranking-section'
import { useVote } from '@/lib/VoteContext'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

jest.mock('@/lib/VoteContext', () => ({
  useVote: jest.fn(() => ({ gameUnlock: { success: false }, selectedCompanies: [] })),
}))

jest.mock('@/components/sponsor/sponsor-cards', () => ({ SponsorCards: () => null }))

// Il client reale (createBrowserClient) è un singleton e RealtimeClient.channel()
// deduplica per topic: una seconda chiamata con lo stesso nome restituisce lo
// STESSO canale. Su quel canale già joinato, `.on()` lancia:
//   "cannot add `postgres_changes` callbacks for realtime:live-ranking-voting-flag after `subscribe()`."
// Questo mock riproduce fedelmente quel comportamento.
const channels = new Map<string, Record<string, unknown>>()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (name: string) => {
      if (!channels.has(name)) {
        const ch: Record<string, unknown> = { joined: false }
        ch.on = () => {
          if (ch.joined) {
            throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${name} after \`subscribe()\`.`)
          }
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

describe('LiveRankingSection — doppio mount con client singleton', () => {
  beforeEach(() => {
    channels.clear()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/flag/voting')) {
        return { ok: true, json: async () => ({ enabled: false }) }
      }
      return { ok: true, json: async () => ({ companies: [] }) }
    })
    ;(useVote as jest.Mock).mockReturnValue({ gameUnlock: { success: false }, selectedCompanies: [] })
  })

  it('non lancia "cannot add ... after subscribe()" quando due istanze condividono lo stesso topic', async () => {
    render(<LiveRankingSection />)
    await act(async () => {})

    expect(() => render(<LiveRankingSection />)).not.toThrow()
    await act(async () => {})
  })
})