'use client';

import { useEffect, useRef, useState } from 'react';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { useLocale } from '@/lib/LocaleContext';
import { createClient } from '@/lib/supabase/client';

interface RankedCompany {
  id: string;
  name: string;
  image_url: string | null;
  total_pallets: number;
  vote_count: number;
}

export function LiveRankingSection() {
  const { t } = useLocale();
  const [companies, setCompanies] = useState<RankedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingEnabled, setVotingEnabled] = useState(true);

  const fetchRanking = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/ranking');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      setError(t('liveRanking.error'));
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
        setError(t('liveRanking.error'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchSilent();
    const interval = setInterval(fetchSilent, 30000);
    return () => clearInterval(interval);
  }, [t]);

  useEffect(() => {
    fetch('/api/public/flag/voting')
      .then(res => res.json())
      .then(data => setVotingEnabled(data.enabled))
      .catch(() => setVotingEnabled(true));

    const supabase = createClient();
    const channel = supabase
      .channel('live-ranking-voting-flag')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: 'key=eq.voting_enabled' }, () => {
        fetch('/api/public/flag/voting')
          .then(res => res.json())
          .then(data => setVotingEnabled(data.enabled));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    <SectionFrame theme="live-ranking" className="flex flex-col justify-between">
      <div className="safe-shell content-max flex flex-col h-full min-h-0">

        <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-(--rythm-blk)">

        <h2 className="text-(length:--fs-headline-tight) font-[900] text-center tracking-tighter lowercase leading-(--lh-headline) text-white">
          {t('liveRanking.title')}
        </h2>

        <p className="text-center text-[clamp(0.875rem,2.5vw,1.125rem)] font-bold text-white">
          {t('liveRanking.subtitle')}
        </p>

        <div className="w-full max-w-2xl mx-auto">
          {!votingEnabled ? (
            <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000] p-3 md:p-6">
              <div className="flex flex-col gap-y-2 md:gap-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="mb-3 animate-pulse">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 bg-gray-300 rounded-full" />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="h-4 bg-gray-300 rounded w-3/5" />
                          <div className="h-5 bg-gray-300 rounded-full w-16 ml-2" />
                        </div>
                        <div className="w-full h-4 bg-gray-300 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <p className="text-lg font-black text-gray-500">
                  🏆 Classifica disponibile durante il Cersaie!
                </p>
              </div>
            </div>
          ) : isLoading ? (
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
                className="bg-bright text-black font-black px-8 py-3 rounded-full border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-0.5 transition-all"
              >
                {t('liveRanking.retry')}
              </button>
            </div>
          ) : companies.length === 0 ? (
            <p className="text-center text-white font-bold text-lg py-8">
              {t('liveRanking.empty')}
            </p>
          ) : (
            <div className={`w-full max-w-2xl mx-auto bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000] p-3 md:p-6 flex flex-col shrink min-h-0 ${showAll ? 'h-[clamp(38svh,48svh,55svh)]' : 'max-h-[clamp(38svh,48svh,55svh)]'}`}>
              <div
                ref={rankingRef}
                className="no-scrollbar flex flex-col flex-1 overflow-y-auto gap-y-2 md:gap-y-3"
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
                            <span className="font-black text-sm bg-bright px-2 py-0.5 rounded-full border-2 border-ink ml-2 whitespace-nowrap">
                              {t('liveRanking.pallets', { count: company.total_pallets })}
                            </span>
                          </div>
                          <div className="w-full h-4 bg-white rounded-full border-2 border-ink overflow-hidden">
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
                  className="mt-2 w-full text-sm font-black text-purple hover:text-black transition-colors py-3 min-h-11 cursor-pointer shrink-0"
                >
                  {showAll ? t('liveRanking.hide') : t('liveRanking.showAll')}
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
    </SectionFrame>
  );
}
