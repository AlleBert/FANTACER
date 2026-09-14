import { render, screen, waitFor } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { VoteStatusRestore } from '@/components/vote-status-restore'
import { setStoredVoterId } from '@/lib/vote-persistence'

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
    jest.restoreAllMocks()
  })

  it('senza visitorId salvato non chiama lo status', () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    renderRestore()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('idrata i voti reali quando il server conferma', async () => {
    setStoredVoterId('v1')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        voted: true,
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
  })

  it('pulisce il visitorId se il server dice voted:false', async () => {
    setStoredVoterId('v1')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voted: false }),
    }) as unknown as typeof fetch

    renderRestore()

    await waitFor(() => expect(localStorage.getItem('fantacer_voter_id')).toBeNull())
  })
})
