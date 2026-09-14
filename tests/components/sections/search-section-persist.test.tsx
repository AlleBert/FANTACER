import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchSection } from '@/components/sections/search-section'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

const mockVote = {
  selectedCompanies: [
    { company: { id: 'c1', name: 'Alpha' }, pallet: 4 },
    { company: { id: 'c2', name: 'Beta' }, pallet: 2 },
    { company: { id: 'c3', name: 'Gamma' }, pallet: 1 },
  ],
  setCompany: jest.fn(),
  removeCompany: jest.fn(),
  setPallet: jest.fn(),
  usedPallets: () => [4, 2, 1],
  unlockGameStep: jest.fn(),
  gameUnlock: { success: false },
}

jest.mock('@/lib/VoteContext', () => ({ useVote: () => mockVote }))
jest.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: (...args: unknown[]) => unknown) => fn,
}))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
      subscribe: () => ({ unsubscribe: jest.fn() }),
    }),
    removeChannel: jest.fn(),
    from: () => ({
      select: () => ({ eq: () => ({ ilike: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }),
    }),
  }),
}))
jest.mock('@/components/voting/turnstile-overlay', () => ({
  TurnstileOverlay: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button onClick={() => onSuccess('token')}>turnstile-ok</button>
  ),
}))
jest.mock('@/components/voting/liquid-fill-button', () => ({
  LiquidFillButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>submit</button>
  ),
}))
jest.mock('@/lib/vote-security', () => ({
  getVoteSecurity: jest.fn().mockResolvedValue({
    turnstile_token: 'token',
    botd: '',
    visitorId: 'v1',
  }),
}))

const setStoredVoterIdMock = jest.fn()
jest.mock('@/lib/vote-persistence', () => ({
  setStoredVoterId: (visitorId: string) => setStoredVoterIdMock(visitorId),
}))

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/public/batch')) {
      return Promise.resolve({ json: async () => ({ activeBatch: 'B1' }) })
    }
    if (url.includes('/api/public/flag/voting')) {
      return Promise.resolve({ json: async () => ({ enabled: true }) })
    }
    if (url.includes('/api/vota')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }
    return Promise.resolve({ json: async () => ({}) })
  }) as unknown as typeof fetch
})

describe('SearchSection — persistenza voto', () => {
  it('salva il visitorId al successo del voto', async () => {
    render(<SearchSection />)

    fireEvent.click(screen.getByText('submit'))
    fireEvent.click(await screen.findByText('turnstile-ok'))

    await waitFor(() => expect(setStoredVoterIdMock).toHaveBeenCalledWith('v1'))
    expect(mockVote.unlockGameStep).toHaveBeenCalledWith('success')
    expect(setStoredVoterIdMock.mock.invocationCallOrder[0]).toBeLessThan(
      mockVote.unlockGameStep.mock.invocationCallOrder[0],
    )
  })

  it('non salva il visitorId se il voto fallisce', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/public/batch')) {
        return Promise.resolve({ json: async () => ({ activeBatch: 'B1' }) })
      }
      if (url.includes('/api/public/flag/voting')) {
        return Promise.resolve({ json: async () => ({ enabled: true }) })
      }
      if (url.includes('/api/vota')) {
        return Promise.resolve({ ok: false, json: async () => ({ success: false, error: 'no' }) })
      }
      return Promise.resolve({ json: async () => ({}) })
    })

    render(<SearchSection />)

    fireEvent.click(screen.getByText('submit'))
    fireEvent.click(await screen.findByText('turnstile-ok'))

    // attende che l'errore sia stato gestito (overlay con il messaggio del server)
    await screen.findByText('no')

    expect(setStoredVoterIdMock).not.toHaveBeenCalled()
    expect(mockVote.unlockGameStep).not.toHaveBeenCalled()
  })
})
