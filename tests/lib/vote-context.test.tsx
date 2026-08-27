import { act, render, screen } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'

const A = { id: 'a', name: 'Azienda A' }
const B = { id: 'b', name: 'Azienda B' }
const C = { id: 'c', name: 'Azienda C' }
const D = { id: 'd', name: 'Azienda D' }

function Harness() {
  const vote = useVote()
  return (
    <div>
      <span data-testid="names">{vote.selectedCompanies.map((c) => c.company.id).join(',')}</span>
      <span data-testid="pallets">{vote.selectedCompanies.map((c) => c.pallet).join(',')}</span>
      <button onClick={() => vote.setCompany(A, 4)}>addA</button>
      <button onClick={() => vote.setCompany(B, 2)}>addB</button>
      <button onClick={() => vote.setCompany(C, 1)}>addC</button>
      <button onClick={() => vote.setCompany(D, 4)}>addD</button>
      <button onClick={() => vote.removeCompany(0)}>remove0</button>
      <button onClick={() => vote.setPallet(0, 1)}>setPallet0to1</button>
      <button onClick={() => vote.unlockGameStep('success')}>vote</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <VoteProvider>
      <Harness />
    </VoteProvider>
  )
}

function names(): string {
  return screen.getByTestId('names').textContent ?? ''
}
function pallets(): string {
  return screen.getByTestId('pallets').textContent ?? ''
}

describe('VoteContext', () => {
  it('seleziona fino a 3 aziende', () => {
    renderHarness()
    act(() => {
      screen.getByText('addA').click()
      screen.getByText('addB').click()
      screen.getByText('addC').click()
      screen.getByText('addD').click()
    })
    expect(names()).toBe('a,b,c')
  })

  it('consente rimozione e cambio pallet prima del voto', () => {
    renderHarness()
    act(() => {
      screen.getByText('addA').click()
      screen.getByText('addB').click()
    })
    act(() => {
      screen.getByText('setPallet0to1').click()
    })
    expect(pallets()).toBe('1,2')
    act(() => {
      screen.getByText('remove0').click()
    })
    expect(names()).toBe('b')
  })

  it('congela la selezione dopo un voto riuscito', () => {
    renderHarness()
    act(() => {
      screen.getByText('addA').click()
      screen.getByText('addB').click()
      screen.getByText('addC').click()
    })
    expect(names()).toBe('a,b,c')

    act(() => {
      screen.getByText('vote').click()
    })

    act(() => {
      screen.getByText('setPallet0to1').click()
      screen.getByText('remove0').click()
      screen.getByText('addD').click()
    })

    expect(names()).toBe('a,b,c')
    expect(pallets()).toBe('4,2,1')
  })
})
