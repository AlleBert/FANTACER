'use client';

import { useEffect, useRef } from 'react';
import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { CommentSection } from '@/components/sections/comment-section'
import { RankingSection } from '@/components/sections/ranking-section'
import { InnovationSection } from '@/components/sections/innovation-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { getOrCreateDeviceId } from '@/lib/fingerprint'

function ScrollManager() {
  const { currentSection } = useVote();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const sectionIndex = currentSection + 4; // 4 non-game sections before game sections
    const main = document.querySelector('main');
    if (main) {
      const sections = main.children;
      if (sections[sectionIndex]) {
        (sections[sectionIndex] as HTMLElement).scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [currentSection]);

  return null;
}

function PageContent() {
  const { gameUnlock } = useVote();

  return (
    <main
      className="overflow-y-auto scroll-smooth no-scrollbar safe-pb"
      style={{ height: 'var(--app-height)' }}
    >
      <HeroSection />
      <IntroSection />
      <HowItWorksSection />
      <PlayAgainSection />
      <PrizeLocationSection />
      <SearchSection />
      {gameUnlock.comment && <CommentSection />}
      {gameUnlock.ranking && <RankingSection />}
      {gameUnlock.innovation && <InnovationSection />}
      {gameUnlock.success && <SuccessSection />}
      <ContactSection />
    </main>
  )
}

export default function Page() {
  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  return (
    <VoteProvider>
      <ScrollManager />
      <PageContent />
    </VoteProvider>
  )
}
