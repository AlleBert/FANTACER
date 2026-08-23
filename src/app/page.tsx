'use client';

import { useEffect } from 'react';
import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { PublicRankingSection } from '@/components/sections/public-ranking-section'
import { LiveRankingSection } from '@/components/sections/live-ranking-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { DevSuccessPreview } from '@/components/dev/dev-success-preview'
import { getOrCreateDeviceId } from '@/lib/device'
import { AppShell } from '@/components/layout/app-shell'

function PageContent() {
  const { gameUnlock } = useVote();

  return (
    <AppShell>
      <HeroSection
        onPlayClick={() => {
          const main = document.querySelector('main');
          const target = main?.querySelector('[data-section="search"]') as HTMLElement | undefined;
          if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        }}
      />
      <IntroSection />
      <HowItWorksSection />
      <PlayAgainSection />
      <PrizeLocationSection />
      <SearchSection />
      {gameUnlock.success && <SuccessSection />}
      <PublicRankingSection />
      <LiveRankingSection />
      <ContactSection />
      <DevSuccessPreview />
    </AppShell>
  )
}

export default function Page() {
  useEffect(() => {
    const deviceId = getOrCreateDeviceId();

    const sendHeartbeat = () => {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: deviceId }),
      }).catch(() => {})
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 30000)
    return () => clearInterval(interval)
  }, []);

  return (
    <VoteProvider>
      <PageContent />
    </VoteProvider>
  )
}
