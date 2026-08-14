import { sectionThemes } from '@/lib/section-themes'

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
    expect(background).toContain('gradient')
  })

  it('keeps play-again and contact visually identical (as today)', () => {
    expect(sectionThemes['play-again'].background).toBe(sectionThemes.contact.background)
  })
})
