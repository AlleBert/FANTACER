import { render, act, screen } from '@testing-library/react';
import { VoteProvider, useVote } from '../src/lib/VoteContext';

describe('VoteContext', () => {
  it('initializes with default state', () => {
    const TestComponent = () => {
      const { selectedCompanies, gameUnlock } = useVote();
      return (
        <>
          <span data-testid="companies">{selectedCompanies.length}</span>
          <span data-testid="success">{gameUnlock.success ? 'yes' : 'no'}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    expect(screen.getByTestId('companies')).toHaveTextContent('0');
    expect(screen.getByTestId('success')).toHaveTextContent('no');
  });

   it('adds companies via setCompany', () => {
     const TestComponent = () => {
       const { selectedCompanies, setCompany } = useVote();
       return (
         <>
           <button onClick={() => setCompany({ id: '123', name: 'Test Co' }, 4)}>Set</button>
           <span data-testid="companies">{selectedCompanies.length}</span>
           <span data-testid="name">{selectedCompanies[0]?.company.name || 'null'}</span>
           <span data-testid="pallet">{selectedCompanies[0]?.pallet || 0}</span>
         </>
       );
     };
     render(
       <VoteProvider>
         <TestComponent />
       </VoteProvider>
     );
     act(() => { screen.getByText('Set').click(); });
     expect(screen.getByTestId('companies')).toHaveTextContent('1');
     expect(screen.getByTestId('name')).toHaveTextContent('Test Co');
     expect(screen.getByTestId('pallet')).toHaveTextContent('4');
   });

  it('removes companies via removeCompany', () => {
    const TestComponent = () => {
      const { selectedCompanies, setCompany, removeCompany } = useVote();
      return (
        <>
          <button onClick={() => setCompany({ id: '123', name: 'Test Co' }, 4)}>Add</button>
          <button onClick={() => removeCompany(0)}>Remove</button>
          <span data-testid="companies">{selectedCompanies.length}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Add').click(); });
    expect(screen.getByTestId('companies')).toHaveTextContent('1');
    act(() => { screen.getByText('Remove').click(); });
    expect(screen.getByTestId('companies')).toHaveTextContent('0');
  });

  it('changes pallet via setPallet', () => {
    const TestComponent = () => {
      const { selectedCompanies, setCompany, setPallet } = useVote();
      return (
        <>
          <button onClick={() => setCompany({ id: '123', name: 'Test Co' }, 4)}>Add</button>
          <button onClick={() => setPallet(0, 2)}>Change</button>
          <span data-testid="pallet">{selectedCompanies[0]?.pallet || 0}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Add').click(); });
    expect(screen.getByTestId('pallet')).toHaveTextContent('4');
    act(() => { screen.getByText('Change').click(); });
    expect(screen.getByTestId('pallet')).toHaveTextContent('2');
  });

  it('limits to 3 companies', () => {
    const TestComponent = () => {
      const { selectedCompanies, setCompany } = useVote();
      return (
        <>
          <button onClick={() => setCompany({ id: 'a', name: 'A' }, 4)}>A</button>
          <button onClick={() => setCompany({ id: 'b', name: 'B' }, 2)}>B</button>
          <button onClick={() => setCompany({ id: 'c', name: 'C' }, 1)}>C</button>
          <button onClick={() => setCompany({ id: 'd', name: 'D' }, 4)}>D</button>
          <span data-testid="count">{selectedCompanies.length}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('A').click(); });
    act(() => { screen.getByText('B').click(); });
    act(() => { screen.getByText('C').click(); });
    act(() => { screen.getByText('D').click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('3');
  });

  it('resets to initial state via RESET', () => {
    const TestComponent = () => {
      const { selectedCompanies, gameUnlock, setCompany, unlockGameStep, resetVote } = useVote();
      return (
        <>
           <button onClick={() => {
            setCompany({ id: '123', name: 'Test Co' }, 4);
            unlockGameStep('success');
          }}>Modify</button>
          <button onClick={resetVote}>Reset</button>
          <span data-testid="count">{selectedCompanies.length}</span>
          <span data-testid="success">{gameUnlock.success ? 'yes' : 'no'}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Modify').click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('success')).toHaveTextContent('yes');
    act(() => { screen.getByText('Reset').click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('success')).toHaveTextContent('no');
  });

  it('reports used pallets via usedPallets', () => {
    const TestComponent = () => {
      const { usedPallets, setCompany } = useVote();
      return (
        <>
          <button onClick={() => setCompany({ id: 'a', name: 'A' }, 4)}>A4</button>
          <button onClick={() => setCompany({ id: 'b', name: 'B' }, 2)}>B2</button>
          <span data-testid="used">{usedPallets().join(',')}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('A4').click(); });
    expect(screen.getByTestId('used')).toHaveTextContent('4');
    act(() => { screen.getByText('B2').click(); });
    expect(screen.getByTestId('used')).toHaveTextContent('4,2');
  });
});
