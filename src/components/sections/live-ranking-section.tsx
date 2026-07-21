'use client';

import { useEffect, useRef, useState } from 'react';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';

interface RankedCompany {
  id: string;
  name: string;
  image_url: string | null;
  total_pallets: number;
  vote_count: number;
}

export function LiveRankingSection() {
  const [companies, setCompanies] = useState<RankedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/ranking');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      setError('classifica non disponibile');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSilent = async () => {
      try {
        const res = await fetch('/api/public/ranking');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        setCompanies(data.companies || []);
      } catch {
        setError('classifica non disponibile');
      }
    };
    fetchSilent();
    const interval = setInterval(fetchSilent, 30000);
    return () => clearInterval(interval);
  }, []);

  const [showAll, setShowAll] = useState(false);
  const rankingRef = useRef<HTMLDivElement>(null);

  const displayedCompanies = showAll ? companies : companies.slice(0, 5);
  const maxPallets = companies.length > 0 ? companies[0].total_pallets : 0;

  const getBarStyle = (pallets: number, leaderValue: number, index: number) => {
    if (index === 0)
      return { background: 'linear-gradient(to bottom, #FFE082 0%, #FFB300 35%, #E68A00 70%, #FFB300 100%)' };

    if (index === 1)
      return { background: 'linear-gradient(to bottom, #F5F5F5 0%, #CCCCCC 35%, #9E9E9E 70%, #CCCCCC 100%)' };

    if (index === 2)
      return { background: 'linear-gradient(to bottom, #EDBB99 0%, #DC7633 35%, #BA4A00 70%, #DC7633 100%)' };

    const ratio = leaderValue > 0 ? pallets / leaderValue : 0;
    if (ratio > 0.50)
      return { background: 'linear-gradient(to bottom, #F5F5F5 0%, #CCCCCC 35%, #9E9E9E 70%, #CCCCCC 100%)' };

    if (ratio >= 0.25)
      return { background: 'linear-gradient(to bottom, #EDBB99 0%, #DC7633 35%, #BA4A00 70%, #DC7633 100%)' };

    return { background: 'linear-gradient(to bottom, #CBD5E1 0%, #94A3B8 50%, #64748B 100%)' };
  };

  const toggleShowAll = () => {
    if (showAll) {
      rankingRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setShowAll(false), 300);
    } else {
      setShowAll(true);
    }
  };

  return (
    <section className="snap-start relative w-full h-[100dvh] bg-gradient-to-b from-[#FF8A26] via-[#FF8A26] to-[#FF2FB2] flex flex-col justify-between overflow-hidden pt-4 md:pt-6 pb-2 md:pb-3">
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-col h-full">

        <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-4 md:gap-6">

        <h2 className="text-[clamp(2rem,7vw,70px)] font-[900] text-center tracking-tighter lowercase leading-[1.1] text-white">
          classifica live
        </h2>

        <p className="text-center text-lg font-bold text-white">
          le aziende più votate del momento
        </p>

        <div className="w-full max-w-2xl mx-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mb-3 animate-pulse">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-white/30 rounded-full" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="h-4 bg-white/30 rounded w-3/5" />
                      <div className="h-5 bg-white/30 rounded-full w-16 ml-2" />
                    </div>
                    <div className="w-full h-4 bg-white/30 rounded-full" />
                  </div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-white font-bold text-lg mb-4">{error}</p>
              <button
                onClick={() => fetchRanking(true)}
                className="bg-[#fccb27] text-black font-black px-8 py-3 rounded-full border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-0.5 transition-all"
              >
                riprova
              </button>
            </div>
          ) : companies.length === 0 ? (
            <p className="text-center text-white font-bold text-lg py-8">
              nessun voto ancora — sii il primo!
            </p>
          ) : (
            <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000] p-4 md:p-6 flex flex-col shrink min-h-0 h-[45dvh] md:h-[55dvh]">
              <div
                ref={rankingRef}
                className="no-scrollbar flex flex-col flex-1 gap-y-2 md:gap-y-3 overflow-y-auto"
              >
                {displayedCompanies.map((company, index) => {
                  const leaderVotes = maxPallets;
                  const dynamicTarget = leaderVotes * 1.25;
                  const barWidth = Math.min((company.total_pallets / dynamicTarget) * 100, 100);
                  const medals = ['🥇', '🥈', '🥉'];
                  const rankDisplay = index < 3 ? medals[index] : `#${index + 1}`;

                  return (
                    <div key={company.id}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xl w-8 text-center">{rankDisplay}</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm md:text-base truncate text-black">{company.name}</span>
                            <span className="font-black text-sm bg-[#fccb27] px-2 py-0.5 rounded-full border-2 border-[#231f20] ml-2 whitespace-nowrap">
                              {company.total_pallets} pallet
                            </span>
                          </div>
                          <div className="w-full h-4 bg-white rounded-full border-2 border-[#231f20] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%`, ...getBarStyle(company.total_pallets, leaderVotes, index) }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {companies.length > 5 && (
                <button
                  onClick={toggleShowAll}
                  className="mt-2 w-full text-sm font-black text-[#8000ff] hover:text-black transition-colors py-2 cursor-pointer shrink-0"
                >
                  {showAll ? 'nascondi ↑' : 'mostra la classifica completa ↓'}
                </button>
              )}
            </div>
          )}
        </div>

        </div>

        <div className="mt-auto w-full flex justify-center">
          <SponsorCards compact />
        </div>
      </div>
    </section>
  );
}
