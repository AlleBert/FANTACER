'use client';

import { useVote } from '@/lib/VoteContext';
import type { Adjective } from '@/lib/VoteContext';
import { RankingOption } from '@/components/ranking-option';
import { Button } from '@/components/ui/button';

const adjectives = [
  'eccezionale',
  'migliore',
  'nella media',
  'peggiore',
] as const satisfies readonly Adjective[];

export function RankingSection() {
  const { selectedCompany, adjective, setAdjective, setCurrentSection, unlockGameStep } = useVote();

  const handleSelect = (option: Adjective) => {
    setAdjective(option);
  };

  const handleNext = () => {
    if (adjective) {
      unlockGameStep('innovation');
      const main = document.querySelector('main');
      const sections = main?.children;
      if (sections && sections[9]) {
        (sections[9] as HTMLElement).scrollIntoView({ behavior: 'smooth' });
      }
      setCurrentSection(4);
    }
  };

  return (
    <section className="snap-start relative w-full h-[100dvh] min-h-[600px] bg-white flex flex-col items-center overflow-hidden">
      <div className="safe-shell flex flex-col items-center justify-between max-w-[1200px] mx-auto">
        {/* Question */}
        <p className="text-[clamp(1.5rem,5vw,40px)] font-[900] text-black text-center lowercase tracking-tighter w-full max-w-4xl mx-auto flex-none pt-4">
          rispetto agli altri stand che hai visto, quello di <span className="text-[#ff803b] underline decoration-2 underline-offset-4">{selectedCompany?.name || 'Nessuna azienda'}</span> è ...
        </p>
         
        <div className="flex-1 min-h-[2vh]" />
        
        {/* Options stack */}
        <div className="flex flex-col gap-4 md:gap-6 w-full max-w-md mx-auto flex-none">
          {adjectives.map((option) => (
            <RankingOption
              key={option}
              label={option}
              isSelected={adjective === option}
              onClick={() => handleSelect(option)}
            />
          ))}
        </div>
        
        <div className="flex-1 min-h-[2vh]" />

        {/* Next button */}
        <div className="flex justify-center w-full flex-none pb-8">
          <Button
            onClick={handleNext}
            disabled={!adjective}
            className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_#000] disabled:hover:translate-y-0"
          >
            &gt;&gt;
          </Button>
        </div>
      </div>
    </section>
  );
}
