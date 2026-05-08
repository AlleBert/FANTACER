import { render, act, screen } from '@testing-library/react';
import { VoteProvider, useVote } from '../src/lib/VoteContext';

describe('VoteContext', () => {
  it('initializes with default state', () => {
    const TestComponent = () => {
      const { selectedCompany, comment, adjective, currentSection } = useVote();
      return (
        <>
          <span data-testid="company">{selectedCompany ? selectedCompany.name : 'null'}</span>
          <span data-testid="comment">{comment}</span>
          <span data-testid="adjective">{adjective || 'null'}</span>
          <span data-testid="section">{currentSection}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    expect(screen.getByTestId('company')).toHaveTextContent('null');
    expect(screen.getByTestId('comment')).toHaveTextContent('');
    expect(screen.getByTestId('adjective')).toHaveTextContent('null');
    expect(screen.getByTestId('section')).toHaveTextContent('1');
  });

  it('updates selectedCompany', () => {
    const TestComponent = () => {
      const { selectedCompany, setSelectedCompany } = useVote();
      return (
        <>
          <button onClick={() => setSelectedCompany({ id: '123', name: 'Test Co' })}>Set</button>
          <span data-testid="company">{selectedCompany?.name || 'null'}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Set').click(); });
    expect(screen.getByTestId('company')).toHaveTextContent('Test Co');
  });
});
