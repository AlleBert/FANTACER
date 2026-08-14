import { sectionThemes } from '@/lib/section-themes'

const originalBackgrounds = {
  hero: 'linear-gradient(180deg, #FF8C23 0%, #4B00AB 100%)',
  intro: 'linear-gradient(to bottom, #FF8C23 0%, #FF8C23 12%, #FF2FB2 50%, #4B00AB 100%)',
  'how-it-works': 'linear-gradient(to bottom, #ff8a26 10%, #FF2FB2 100%)',
  'play-again': 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
  'prize-location': 'linear-gradient(to bottom, #4B00AB 0%, #4B00AB 30%, #8A2BE2 60%, #E0B0FF 85%, #FFFFFF 100%)',
  search: '#FFFFFF',
  'public-ranking': 'linear-gradient(to bottom, #ff8a26 0%, #FF2FB2 25%, #FF2FB2 100%)',
  'live-ranking': 'linear-gradient(to bottom, #ff8a26 0%, #ff8a26 50%, #FF2FB2 100%)',
  success: 'linear-gradient(to bottom, #FFFFFF 0%, #FF2FB2 45%, #ff8a26 75%)',
  contact: 'linear-gradient(to bottom, #FF2FB2 0%, #4B00AB 60%, #4B00AB 100%)',
} as const

describe('sectionThemes', () => {
  const expectedKeys = [
    'hero',
    'intro',
    'how-it-works',
    'play-again',
    'prize-location',
    'search',
    'public-ranking',
    'live-ranking',
    'success',
    'contact',
  ]

  it('exposes exactly the expected section keys', () => {
    expect(Object.keys(sectionThemes)).toEqual(expectedKeys)
  })

  it.each(expectedKeys)('defines a non-empty CSS background for "%s"', (key) => {
    const background = sectionThemes[key as keyof typeof sectionThemes].background
    expect(background.length).toBeGreaterThan(0)
    if (key === 'search') {
      expect(background).toBe('#FFFFFF')
    } else {
      expect(background).toContain('gradient')
    }
  })

  it.each(expectedKeys)('defines a valid solid themeColor for "%s"', (key) => {
    const themeColor = sectionThemes[key as keyof typeof sectionThemes].themeColor
    expect(themeColor.length).toBeGreaterThan(0)
    expect(isValidColor(themeColor)).toBe(true)
  })

  it.each(expectedKeys)('keeps the original background value untouched for "%s"', (key) => {
    const background = sectionThemes[key as keyof typeof sectionThemes].background
    expect(background).toBe(originalBackgrounds[key as keyof typeof sectionThemes])
  })

  it('maps activeSection theme keys to a themeColor per gradient top', () => {
    const map = new Map(Object.entries(sectionThemes).map(([key, v]) => [key, v.themeColor]))
    expect(map.get('hero')).toBe('#FF8C23')
    expect(map.get('intro')).toBe('#FF8C23')
    expect(map.get('how-it-works')).toBe('#ff8a26')
    expect(map.get('play-again')).toBe('#FF2FB2')
    expect(map.get('prize-location')).toBe('#4B00AB')
    expect(map.get('search')).toBe('#FFFFFF')
    expect(map.get('public-ranking')).toBe('#ff8a26')
    expect(map.get('live-ranking')).toBe('#ff8a26')
    expect(map.get('success')).toBe('#FFFFFF')
    expect(map.get('contact')).toBe('#FF2FB2')
  })

  it('starts intro with a flat monochromatic top band matching its themeColor', () => {
    const intro = sectionThemes.intro
    expect(intro.background.startsWith('linear-gradient(to bottom, #FF8C23 0%, #FF8C23 ')).toBe(true)
    expect(intro.themeColor).toBe('#FF8C23')
  })

  it('keeps search (voting section) a solid pure white background', () => {
    const search = sectionThemes.search
    expect(search.background).toBe('#FFFFFF')
    expect(search.themeColor).toBe('#FFFFFF')
    expect(search.background).not.toContain('gradient')
  })

  it('keeps play-again and contact visually identical (as today)', () => {
    expect(sectionThemes['play-again'].background).toBe(sectionThemes.contact.background)
  })
})

function isValidColor(value: string): boolean {
  const probe = document.createElement('div')
  probe.style.color = value
  return probe.style.color !== ''
}
