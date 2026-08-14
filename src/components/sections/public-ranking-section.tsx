'use client';

import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { useLocale } from '@/lib/LocaleContext';

export function PublicRankingSection() {
  const { t } = useLocale();

  return (
    <SectionFrame theme="public-ranking" className="flex flex-col justify-between py-4">
      <div className="safe-shell w-full max-w-7xl mx-auto flex flex-col items-center justify-center h-full gap-6 md:gap-8 relative z-10 flex-1 min-h-0">

        <h2 className="text-[clamp(2rem,7vw,70px)] font-[900] text-center tracking-tighter lowercase leading-[1.1] text-white">
          {t('publicRanking.title')}
        </h2>

        <SponsorCards />

      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[15vh] bg-gradient-to-b from-transparent to-orange pointer-events-none z-0" />
    </SectionFrame>
  );
}
