'use client';

import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { useLocale } from '@/lib/LocaleContext';

export function PublicRankingSection() {
  const { t } = useLocale();

  return (
    <SectionFrame theme="public-ranking" className="flex flex-col justify-between">
      <div className="safe-shell content-max flex flex-col items-center justify-center h-full gap-(--rythm-sec) relative z-10 flex-1 min-h-0">

        <h2 className="text-(length:--fs-headline) font-[900] text-center tracking-tighter lowercase leading-(--lh-headline) text-white">
          {t('publicRanking.title')}
        </h2>

        <SponsorCards />

      </div>
    </SectionFrame>
  );
}
