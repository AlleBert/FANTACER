import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { SelectedStandSection } from '@/components/sections/selected-stand-section'
import { RankingSection } from '@/components/sections/ranking-section'
import { InnovationSection } from '@/components/sections/innovation-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'

export default function Page() {
  return (
    <main
      className="overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar pb-safe"
      style={{ height: 'var(--app-height)' }}
    >
      <HeroSection />
      <IntroSection />
      <HowItWorksSection />
      <PlayAgainSection />
      <PrizeLocationSection />
      <SearchSection />
      <SelectedStandSection />
      <RankingSection />
      <InnovationSection />
      <SuccessSection />
      <ContactSection />
    </main>
  )
}
