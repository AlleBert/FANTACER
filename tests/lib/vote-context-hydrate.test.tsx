import { act, render, screen } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'

function Harness() {
  const vote = useVote()
  return (
    <div>
      <span data-testid="names">{vote.selectedCompanies.map((c) => c.company.id).join(',')}</span>
      <span data-testid="success">{vote.gameUnlock.success ? 'yes' : 'no'}</span>
      <button
        onClick={() =>
          vote.hydrateVote([
            { company: { id: 'x', name: 'X' }, pallet: 4 },
            { company: { id: 'y', name: 'Y' }, pallet: 2 },
            { company: { id: 'z', name: 'Z' }, pallet: 1 },
          ])
        }
      >
        hydrate
      </button>
      <button
        onClick={() => vote.hydrateVote([{ company: { id: 'w', name: 'W' }, pallet: 4 }])}
      >
        rehydrate
      </button>
      <button onClick={() => vote.setCompany({ id: 'n', name: 'N' }, 4)}>add</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <VoteProvider>
      <Harness />
    </VoteProvider>,
  )
}

describe('VoteContext HYDRATE', () => {
  it('ripristina i voti reali e congela la selezione', () => {
    renderHarness()
    act(() => {
      screen.getByText('hydrate').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('x,y,z')
    expect(screen.getByTestId('success')).toHaveTextContent('yes')

    act(() => {
      screen.getByText('add').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('x,y,z')
  })

  it('ignora HYDRATE se il voto è già confermato in sessione', () => {
    renderHarness()
    act(() => {
      screen.getByText('hydrate').click()
      screen.getByText('rehydrate').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('x,y,z')
  })
})
