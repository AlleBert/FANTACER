'use client';

import { useEffect } from 'react';
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
import { VoteProvider } from '@/lib/VoteContext'
import { getOrCreateDeviceId } from '@/lib/fingerprint'

export default function Page() {
  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  return (
    <VoteProvider>
      <main
        className="overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar safe-pb"
        style={{ height: 'var(--app-height)' }}
      >
        <HeroSection />
        <IntroSection />
        <HowItWorksSection />
        <PlayAgainSection />
        <PrizeLocationSection />
        <SearchSection />
        <CommentSection />
        <RankingSection />
        <InnovationSection />
        <SuccessSection />
        <ContactSection />
      </main>
    </VoteProvider>
  )
}
