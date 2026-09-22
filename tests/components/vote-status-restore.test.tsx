import { render, screen, waitFor } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { VoteStatusRestore } from '@/components/vote-status-restore'
import { setStoredVoterId } from '@/lib/vote-persistence'
import { VOTER_COOKIE } from '@/lib/vote-identity'
import { __resetVoterIdentityForTests } from '@/lib/vote-client-identity'

const UUID = '11111111-2222-4333-8444-555555555555'

function Probe() {
  const { selectedCompanies, gameUnlock } = useVote()
  return (
    <div>
      <span data-testid="names">{selectedCompanies.map((c) => c.company.id).join(',')}</span>
      <span data-testid="success">{gameUnlock.success ? 'yes' : 'no'}</span>
    </div>
  )
}

function renderRestore() {
  return render(
    <VoteProvider>
      <VoteStatusRestore />
      <Probe />
    </VoteProvider>,
  )
}

describe('VoteStatusRestore', () => {
  afterEach(() => {
    localStorage.clear()
    document.cookie = `${VOTER_COOKIE}=; Max-Age=0; Path=/`
    __resetVoterIdentityForTests()
    jest.restoreAllMocks()
  })

  it('senza identità salvata non chiama lo status (identità nuova)', async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    renderRestore()
    await waitFor(() => expect(localStorage.getItem('fantacer_voter_id')).not.toBeNull())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('idrata i voti reali quando il server conferma', async () => {
    setStoredVoterId(UUID)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        voted: true,
        voterId: UUID,
        companies: [
          { id: 'c1', name: 'Alpha', pallet: 4 },
          { id: 'c2', name: 'Beta', pallet: 2 },
          { id: 'c3', name: 'Gamma', pallet: 1 },
        ],
      }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('c1,c2,c3'))
    expect(screen.getByTestId('success')).toHaveTextContent('yes')
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.voterId).toBe(UUID)
  })

  it('mantiene l\'identità quando il server dice voted:false', async () => {
    setStoredVoterId(UUID)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voted: false, voterId: UUID }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(localStorage.getItem('fantacer_voter_id')).toBe(UUID)
  })

  it('riallinea l\'identità salvata con quella risolta dal server', async () => {
    setStoredVoterId(UUID)
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voted: false, voterId: other }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(localStorage.getItem('fantacer_voter_id')).toBe(other))
  })

  it('risposta non-ok preserva il voterId salvato', async () => {
    setStoredVoterId(UUID)
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ voted: false }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(localStorage.getItem('fantacer_voter_id')).toBe(UUID)
    expect(screen.getByTestId('success')).toHaveTextContent('no')
  })

  it('voted:true con meno di 3 aziende è un no-op', async () => {
    setStoredVoterId(UUID)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        voted: true,
        voterId: UUID,
        companies: [{ id: 'c1', name: 'Alpha', pallet: 4 }],
      }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await waitFor(() => {
      expect(localStorage.getItem('fantacer_voter_id')).toBe(UUID)
      expect(screen.getByTestId('success')).toHaveTextContent('no')
    })
  })
})
