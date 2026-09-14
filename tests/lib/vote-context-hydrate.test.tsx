import { act, render, screen } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'

function Harness() {
  const vote = useVote()
  return (
    <div>
      <span data-testid="names">{vote.selectedCompanies.map((c) => c.company.id).join(',')}</span>
      <span data-testid="success">{vote.gameUnlock.success ? 'yes' : 'no'}</span>
      <span data-testid="celebrate">{vote.celebrate ? 'yes' : 'no'}</span>
      <button onClick={() => vote.unlockGameStep('success')}>vote</button>
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
        onClick={() =>
          vote.hydrateVote([
            { company: { id: 'w1', name: 'W1' }, pallet: 4 },
            { company: { id: 'w2', name: 'W2' }, pallet: 2 },
            { company: { id: 'w3', name: 'W3' }, pallet: 1 },
          ])
        }
      >
        rehydrate
      </button>
      <button onClick={() => vote.setCompany({ id: 'n', name: 'N' }, 4)}>add</button>
      <button
        onClick={() => {
          vote.setCompany({ id: 'p', name: 'P' }, 4)
          vote.setCompany({ id: 'q', name: 'Q' }, 2)
        }}
      >
        addTwo
      </button>
      <button
        onClick={() =>
          vote.hydrateVote([
            { company: { id: 'x', name: 'X' }, pallet: 4 },
            { company: { id: 'y', name: 'Y' }, pallet: 2 },
          ])
        }
      >
        bad
      </button>
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

  it('sostituisce una selezione non ancora inviata', () => {
    renderHarness()
    act(() => {
      screen.getByText('addTwo').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('p,q')

    act(() => {
      screen.getByText('hydrate').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('x,y,z')
    expect(screen.getByTestId('success')).toHaveTextContent('yes')
  })

  it('ignora HYDRATE con payload di lunghezza diversa da 3', () => {
    renderHarness()
    act(() => {
      screen.getByText('addTwo').click()
    })
    act(() => {
      screen.getByText('bad').click()
    })
    expect(screen.getByTestId('names')).toHaveTextContent('p,q')
    expect(screen.getByTestId('success')).toHaveTextContent('no')
  })

  it('HYDRATE non attiva i confetti (celebrate false)', () => {
    renderHarness()
    act(() => {
      screen.getByText('hydrate').click()
    })
    expect(screen.getByTestId('celebrate')).toHaveTextContent('no')
  })

  it('un voto espresso in sessione attiva i confetti (celebrate true)', () => {
    renderHarness()
    act(() => {
      screen.getByText('vote').click()
    })
    expect(screen.getByTestId('celebrate')).toHaveTextContent('yes')
  })
})
