'use client';

import { useEffect } from 'react';
import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { SearchSection } from '@/components/sections/search-section'
import { PublicRankingSection } from '@/components/sections/public-ranking-section'
import { LiveRankingSection } from '@/components/sections/live-ranking-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { RealtimeProvider } from '@/lib/RealtimeContext'
import { DevSuccessPreview } from '@/components/dev/dev-success-preview'
import { getOrCreateDeviceId } from '@/lib/device'
import { AppShell } from '@/components/layout/app-shell'
import { VoteStatusRestore } from '@/components/vote-status-restore'

function PageContent() {
  const { gameUnlock } = useVote();

  return (
    <AppShell>
      <HeroSection
        onScrollDown={() => {
          const main = document.querySelector('main');
          const target = main?.querySelector('[data-section="intro"]') as HTMLElement | undefined;
          if (main && target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        }}
      />
      <IntroSection />
      <HowItWorksSection />
      <PlayAgainSection />
      <SearchSection />
      {gameUnlock.success && <SuccessSection />}
      <PublicRankingSection />
      <LiveRankingSection showWhenDisabled />
      <ContactSection />
      <DevSuccessPreview />
    </AppShell>
  )
}

export default function Page() {
  useEffect(() => {
    const deviceId = getOrCreateDeviceId();

    const sendHeartbeat = () => {
      // Niente write in background: il conteggio "online" è a 5 minuti, quindi
      // una battuta ogni 90s a scheda visibile è sufficiente. `keepalive`
      // consente l'invio anche durante unload/visibilitychange.
      if (document.visibilityState !== 'visible') return;
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: deviceId }),
        keepalive: true,
      }).catch(() => {})
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 90000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, []);

  return (
    <VoteProvider>
      <RealtimeProvider>
        <VoteStatusRestore />
        <PageContent />
      </RealtimeProvider>
    </VoteProvider>
  )
}
