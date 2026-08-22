'use client';

import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { SafeCenterSection } from '@/components/layout/safe-center-section';
import { useLocale } from '@/lib/LocaleContext';
import { useSponsorMaxItems } from '@/hooks/use-sponsor-max-items';

export function PublicRankingSection() {
  const { t } = useLocale();
  const maxItems = useSponsorMaxItems();

  return (
    <SectionFrame theme="public-ranking" className="flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-sec)" className="content-max relative z-10">
        <h2 className="text-(length:--fs-headline) font-[900] text-center tracking-tighter lowercase leading-(--lh-headline) text-white">
          {t('publicRanking.title')}
        </h2>
      </SafeCenterSection>

      {/* Sponsor footer fisso */}
      <div className="flex-shrink-0 w-full flex justify-center p-(--space-md)">
        <SponsorCards maxItems={maxItems} />
      </div>
    </SectionFrame>
  );
}
