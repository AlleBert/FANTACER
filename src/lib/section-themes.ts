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
 *
 * `themeColor` is a single solid color representing the dominant color at the
 * top of the gradient, used by `BrowserThemeColor` to keep the iOS status bar
 * coherent with the current section. It is declarative (never parsed from the
 * gradient string) because the status bar only accepts a solid color, not a
 * gradient.
 */
export const sectionThemes = {
  hero: {
    background: 'linear-gradient(180deg, #FF8C23 0%, #4B00AB 100%)',
    themeColor: '#FF8C23',
  },
  intro: {
    background: 'linear-gradient(to bottom, #FF8C23 0%, #FF8C23 12%, #FF2FB2 50%, #4B00AB 100%)',
    themeColor: '#FF8C23',
  },
  'how-it-works': {
    background: 'linear-gradient(to bottom, #ff8a26 10%, #FF2FB2 100%)',
    themeColor: '#ff8a26',
  },
  'play-again': {
    background: 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
    themeColor: '#FF2FB2',
  },
  'prize-location': {
    background: 'linear-gradient(to bottom, #4B00AB 0%, #4B00AB 30%, #8A2BE2 60%, #E0B0FF 85%, #FFFFFF 100%)',
    themeColor: '#4B00AB',
  },
  search: {
    background: '#FFFFFF',
    themeColor: '#FFFFFF',
  },
  'public-ranking': {
    background: 'linear-gradient(to bottom, #ff8a26 0%, #FF2FB2 25%, #FF2FB2 100%)',
    themeColor: '#ff8a26',
  },
  'live-ranking': {
    background: 'linear-gradient(to bottom, #ff8a26 0%, #ff8a26 50%, #FF2FB2 100%)',
    themeColor: '#ff8a26',
  },
  success: {
    background: 'linear-gradient(to bottom, #FFFFFF 0%, #FF2FB2 45%, #ff8a26 75%)',
    themeColor: '#FFFFFF',
  },
  contact: {
    background: 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
    themeColor: '#FF2FB2',
  },
} as const;

export type SectionThemeKey = keyof typeof sectionThemes;
