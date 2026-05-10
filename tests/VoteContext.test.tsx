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

  it('updates comment via SET_COMMENT', () => {
    const TestComponent = () => {
      const { comment, setComment } = useVote();
      return (
        <>
          <button onClick={() => setComment('Test comment')}>Set</button>
          <span data-testid="comment">{comment}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Set').click(); });
    expect(screen.getByTestId('comment')).toHaveTextContent('Test comment');
  });

  it('updates adjective via SET_ADJECTIVE', () => {
    const TestComponent = () => {
      const { adjective, setAdjective } = useVote();
      return (
        <>
          <button onClick={() => setAdjective('eccezionale')}>Set</button>
          <span data-testid="adjective">{adjective || 'null'}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Set').click(); });
    expect(screen.getByTestId('adjective')).toHaveTextContent('eccezionale');
  });

  it('updates slider value and clamps to 0-100 via SET_SLIDER', () => {
    const TestComponent = () => {
      const { sliders, setSlider } = useVote();
      return (
        <>
          <button onClick={() => setSlider('innovation', 75)}>Set Valid</button>
          <button onClick={() => setSlider('innovation', 150)}>Set Over</button>
          <button onClick={() => setSlider('innovation', -20)}>Set Under</button>
          <span data-testid="innovation">{sliders.innovation}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Set Valid').click(); });
    expect(screen.getByTestId('innovation')).toHaveTextContent('75');
    act(() => { screen.getByText('Set Over').click(); });
    expect(screen.getByTestId('innovation')).toHaveTextContent('100');
    act(() => { screen.getByText('Set Under').click(); });
    expect(screen.getByTestId('innovation')).toHaveTextContent('0');
  });

  it('updates currentSection via SET_SECTION', () => {
    const TestComponent = () => {
      const { currentSection, setCurrentSection } = useVote();
      return (
        <>
          <button onClick={() => setCurrentSection(3)}>Set</button>
          <span data-testid="section">{currentSection}</span>
        </>
      );
    };
    render(
      <VoteProvider>
        <TestComponent />
      </VoteProvider>
    );
    act(() => { screen.getByText('Set').click(); });
    expect(screen.getByTestId('section')).toHaveTextContent('3');
  });

  it('resets to initial state via RESET', () => {
    const TestComponent = () => {
      const { comment, adjective, currentSection, setComment, setAdjective, setCurrentSection, resetVote } = useVote();
      return (
        <>
          <button onClick={() => {
            setComment('Changed');
            setAdjective('peggiore');
            setCurrentSection(4);
          }}>Modify</button>
          <button onClick={resetVote}>Reset</button>
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
    act(() => { screen.getByText('Modify').click(); });
    expect(screen.getByTestId('comment')).toHaveTextContent('Changed');
    expect(screen.getByTestId('adjective')).toHaveTextContent('peggiore');
    expect(screen.getByTestId('section')).toHaveTextContent('4');
    act(() => { screen.getByText('Reset').click(); });
    expect(screen.getByTestId('comment')).toHaveTextContent('');
    expect(screen.getByTestId('adjective')).toHaveTextContent('null');
    expect(screen.getByTestId('section')).toHaveTextContent('1');
  });
 });
