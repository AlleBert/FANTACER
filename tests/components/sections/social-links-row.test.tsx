import { render } from '@testing-library/react'
import { SocialLinksRow } from '@/components/sections/social-links-row'

describe('SocialLinksRow', () => {
  it('rende solo Instagram quando facebookUrl è vuoto', () => {
    const { container } = render(
      <SocialLinksRow instagramUrl="https://instagram.com/fanta.cer" facebookUrl="" />
    )
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(1)
    expect(links[0].getAttribute('href')).toBe('https://instagram.com/fanta.cer')
  })

  it('rende Instagram e Facebook quando facebookUrl è valorizzato', () => {
    const { container } = render(
      <SocialLinksRow instagramUrl="https://instagram.com/fanta.cer" facebookUrl="https://facebook.com/fantacer" />
    )
    const links = container.querySelectorAll('a')
    expect(links.length).toBe(2)
    expect(links[1].getAttribute('href')).toBe('https://facebook.com/fantacer')
  })
})
