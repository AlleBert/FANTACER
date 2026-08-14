/**
 * Source of truth for section backgrounds.
 *
 * Single centralized map: section id -> full CSS `background` value.
 * Values reproduce EXACTLY the gradients currently applied inline on each
 * `<section>` (extracted from the Tailwind arbitrary classes). The `BackgroundLayer`
 * is the only component that reads these values; section components must not
 * hardcode gradient hexes.
 *
 * `data-section={key}` on each `<SectionFrame>` is the stable identifier used by
 * `useActiveSection` to determine which theme is active while scrolling.
 */
export const sectionThemes = {
  hero: {
    background: 'linear-gradient(180deg, #FF8C23 0%, #4B00AB 100%)',
  },
  intro: {
    background: 'radial-gradient(circle at top left, #FF8C23 0%, #FF2FB2 50%, #4B00AB 100%)',
  },
  'how-it-works': {
    background: 'linear-gradient(to bottom, #ff8a26 10%, #FF2FB2 100%)',
  },
  'play-again': {
    background: 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
  },
  'prize-location': {
    background: 'linear-gradient(to bottom, #4B00AB 0%, #4B00AB 30%, #8A2BE2 60%, #E0B0FF 85%, #FFFFFF 100%)',
  },
  search: {
    background: 'radial-gradient(circle at center, rgba(194,225,255,0.2) 0%, rgba(255,255,255,1) 100%)',
  },
  'public-ranking': {
    background: 'linear-gradient(to bottom, #ff8a26 0%, #FF2FB2 25%, #FF2FB2 100%)',
  },
  'live-ranking': {
    background: 'linear-gradient(to bottom, #ff8a26 0%, #ff8a26 50%, #FF2FB2 100%)',
  },
  success: {
    background: 'linear-gradient(to bottom, #FFFFFF 0%, #FF2FB2 45%, #ff8a26 75%)',
  },
  contact: {
    background: 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
  },
} as const;

export type SectionThemeKey = keyof typeof sectionThemes;
