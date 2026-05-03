'use client'

import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { HowItWorksSection } from '@/components/sections/how-it-works-section'
import { PlayAgainSection } from '@/components/sections/play-again-section'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { SelectedStandSection } from '@/components/sections/selected-stand-section'
// import { CategoryRatingSection } from '@/components/sections/category-rating-section'
import { RankingSection } from '@/components/sections/ranking-section'
import { InnovationSection } from '@/components/sections/innovation-section'
import { SuccessSection } from '@/components/sections/success-section'
import { ContactSection } from '@/components/sections/contact-section'

export default function Page() {
  return (
    <main className="h-[100dvh] overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar">
      <div className="snap-start h-[100dvh]"><HeroSection /></div>
      <div className="snap-start h-[100dvh]"><IntroSection /></div>
      <div className="snap-start h-[100dvh]"><HowItWorksSection /></div>
      <div className="snap-start h-[100dvh]"><PlayAgainSection /></div>
      <div className="snap-start h-[100dvh]"><PrizeLocationSection /></div>
      <div className="snap-start h-[100dvh]"><SearchSection /></div>
      <div className="snap-start h-[100dvh]"><SelectedStandSection /></div>
      {/* <div className="snap-start h-[100dvh]"><CategoryRatingSection /></div> */}
      <div className="snap-start h-[100dvh]"><RankingSection /></div>
      <div className="snap-start h-[100dvh]"><InnovationSection /></div>
      <div className="snap-start h-[100dvh]"><SuccessSection /></div>
      <div className="snap-start h-[100dvh]"><ContactSection /></div>
    </main>
  )
}