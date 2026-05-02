'use client'

import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { SelectedStandSection } from '@/components/sections/selected-stand-section'
import { CategoryRatingSection } from '@/components/sections/category-rating-section'
import { RankingSection } from '@/components/sections/ranking-section'
import { InnovationSection } from '@/components/sections/innovation-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'

export default function Page() {
  return (
    <main className="flex flex-col w-full">
      <HeroSection />
      <IntroSection />
      <HowItWorksSection />
      <PlayAgainSection />
      <PrizeLocationSection />
      <SearchSection />
      <SelectedStandSection />
      <CategoryRatingSection />
      <RankingSection />
      <InnovationSection />
      <SuccessSection />
      <ContactSection />
    </main>
  )
}