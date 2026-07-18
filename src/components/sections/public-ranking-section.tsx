'use client';

import { useVote } from '@/lib/VoteContext';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';

export function PublicRankingSection() {
  const { selectedCompanies, gameUnlock } = useVote();

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#FF8C23_0%,#FF2FB2_50%,#4B00AB_100%)]">
      <div className="safe-shell flex flex-col items-center justify-center">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          <h2 className="text-[clamp(2rem,7vw,70px)] font-[900] text-center mb-6 tracking-tighter lowercase leading-[1.1] text-white drop-shadow-[2px_2px_0_#231f20]">
            guarda la classifica aggiornata
          </h2>

          {gameUnlock.success && selectedCompanies.length > 0 && (
            <div className="w-full max-w-xl bg-white rounded-2xl border-[3px] border-[#231f20] shadow-[4px_4px_0_#000] p-6 mb-6">
              <p className="text-center font-black text-[#8000ff] mb-4 text-lg">IL TUO VOTO</p>
              {selectedCompanies.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b-2 border-[#231f20]/20 last:border-b-0">
                  <span className="text-lg font-bold">{item.company.name}</span>
                  <span className="bg-[#fccb27] px-4 py-1 rounded-full border-2 border-[#231f20] font-black">{item.pallet} pallet</span>
                </div>
              ))}
            </div>
          )}

          {!gameUnlock.success && (
            <p className="text-center text-xl font-bold text-white mb-8 drop-shadow-[2px_2px_0_#231f20]">
              Vota per vedere la tua classifica personale!
            </p>
          )}

          <SponsorCards className="mb-8" />

          <div className="flex-1 min-h-[4vh]" />
        </div>
      </div>
    </section>
  );
}
