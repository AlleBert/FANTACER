'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchRanking();
    const interval = setInterval(fetchRanking, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRanking = async () => {
    try {
      const res = await fetch('/api/public/ranking');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      // silent
    }
  };

  const maxPallets = companies.length > 0 ? companies[0].total_pallets : 0;

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[linear-gradient(to_bottom,#ffffff_0%,#f0e6ff_50%,#e0d0ff_100%)]">
      <div className="safe-shell flex flex-col items-center justify-center">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          <h2 className="text-[clamp(2rem,7vw,70px)] font-[900] text-center mb-6 tracking-tighter lowercase leading-[1.1] text-[#4B00AB]">
            classifica live
          </h2>

          <p className="text-center text-lg font-bold text-[#8000ff] mb-8">
            le aziende più votate del momento
          </p>

          <div className="w-full max-w-2xl mx-auto mb-8">
            {companies.map((company, index) => {
              const barWidth = maxPallets > 0 ? (company.total_pallets / maxPallets) * 100 : 0;
              const medals = ['🥇', '🥈', '🥉'];
              const rankDisplay = index < 3 ? medals[index] : `#${index + 1}`;

              return (
                <div key={company.id} className="mb-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xl w-8 text-center">{rankDisplay}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm md:text-base truncate">{company.name}</span>
                        <span className="font-black text-sm bg-[#fccb27] px-2 py-0.5 rounded-full border-2 border-[#231f20] ml-2 whitespace-nowrap">
                          {company.total_pallets} pallet
                        </span>
                      </div>
                      <div className="w-full h-4 bg-white rounded-full border-2 border-[#231f20] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#8000ff] to-[#fccb27] rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <SponsorCards className="mb-8" />
        </div>
      </div>
    </section>
  );
}
