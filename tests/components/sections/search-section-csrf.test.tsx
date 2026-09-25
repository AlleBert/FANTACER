import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchSection } from '@/components/sections/search-section'
import { clearCsrfToken, setCsrfToken } from '@/lib/session-client'

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
jest.mock('@/lib/RealtimeContext', () => ({
  useRealtime: () => ({ votingEnabled: true, antibotEnabled: false }),
}))
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
  TurnstileOverlay: ({
    onSuccess,
    action = 'vote',
  }: {
    onSuccess: (token: string) => void
    action?: string
  }) => (
    <button
      data-testid={action === 'bootstrap' ? 'turnstile-bootstrap' : 'turnstile-ok'}
      data-action={action}
      onClick={() => onSuccess('token')}
    >
      {action === 'bootstrap' ? 'turnstile-bootstrap' : 'turnstile-ok'}
    </button>
  ),
}))
jest.mock('@/components/voting/liquid-fill-button', () => ({
  LiquidFillButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>submit</button>
  ),
}))
jest.mock('@/lib/vote-security', () => ({
  getVisitorId: jest.fn().mockResolvedValue('v1'),
  getVoteSecurity: jest.fn().mockResolvedValue({
    turnstile_token: 'token',
    botd: '',
    visitorId: 'v1',
    voterId: '11111111-2222-4333-8444-555555555555',
  }),
}))
jest.mock('@/lib/vote-client-identity', () => ({
  ensureVoterId: jest.fn().mockResolvedValue('11111111-2222-4333-8444-555555555555'),
  isNewVoterIdentity: () => false,
  bridgeLegacyIdentityToCookie: jest.fn(),
}))
jest.mock('@/lib/vote-persistence', () => ({
  setStoredVoterId: jest.fn(),
  getStoredVoterId: () => null,
}))

function voteCall(fetchMock: jest.Mock): [unknown, RequestInit] {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/vota'))
  if (!call) throw new Error('nessuna chiamata a /api/vota')
  return call as [unknown, RequestInit]
}

beforeEach(() => {
  jest.clearAllMocks()
  clearCsrfToken()
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/public/batch')) {
      return Promise.resolve({ json: async () => ({ activeBatch: 'B1' }) })
    }
    if (url.includes('/api/vota')) {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }
    // nonce/bootstrap: 404 → identità off
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
  }) as unknown as typeof fetch
})

afterEach(() => {
  clearCsrfToken()
})

describe('SearchSection — CSRF', () => {
  it('invia X-CSRF-Token su /api/vota quando il token esiste', async () => {
    setCsrfToken('csrf-test')
    render(<SearchSection />)

    fireEvent.click(screen.getByText('submit'))
    fireEvent.click(await screen.findByText('turnstile-ok'))

    await waitFor(() => {
      const [, init] = voteCall(global.fetch as jest.Mock)
      expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test')
    })
  })

  it('senza sessione esegue il bootstrap (action bootstrap) e poi invia il CSRF al voto', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/identity/bootstrap/nonce')) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: 'n', cData: 'bootstrap:n' }) })
      }
      if (url.includes('/api/identity/bootstrap')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, csrfToken: 'csrf-boot' }) })
      }
      if (url.includes('/api/vota')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    })

    render(<SearchSection />)
    fireEvent.click(screen.getByText('submit'))

    const bootstrapWidget = await screen.findByTestId('turnstile-bootstrap')
    expect(bootstrapWidget.getAttribute('data-action')).toBe('bootstrap')
    fireEvent.click(bootstrapWidget)

    // Solo dopo il bootstrap compare il challenge di voto.
    await screen.findByTestId('turnstile-ok')
    fireEvent.click(screen.getByTestId('turnstile-ok'))

    await waitFor(() => {
      const [, init] = voteCall(global.fetch as jest.Mock)
      expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-boot')
    })
  })

  it('senza sessione resta legacy: nessun header CSRF', async () => {
    render(<SearchSection />)

    fireEvent.click(screen.getByText('submit'))
    fireEvent.click(await screen.findByText('turnstile-ok'))

    await waitFor(() => {
      const [, init] = voteCall(global.fetch as jest.Mock)
      expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined()
    })
    expect(mockVote.unlockGameStep).toHaveBeenCalledWith('success')
  })
})
