import { render, screen } from '@testing-library/react'
import { ActionBar } from '@/components/sections/action-bar'
import type { SelectedCompany } from '@/lib/VoteContext'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))
jest.mock('@/components/sections/share-button', () => ({
  ShareButton: ({ text, url }: { text: string; url: string }) => (
    <button type="button" aria-label="Condividi">
      {text} {url}
    </button>
  ),
}))
jest.mock('@/components/sections/save-button', () => ({
  SaveButton: () => (
    <button type="button" aria-label="Salva">
      Salva
    </button>
  ),
}))

let mockFacebookUrl = ''

jest.mock('@/lib/social-links', () => ({
  INSTAGRAM_URL: 'https://instagram.com/fanta.cer',
  get FACEBOOK_URL() {
    return mockFacebookUrl
  },
}))

describe('ActionBar', () => {
  const companies: SelectedCompany[] = [
    { company: { id: 'a', name: 'Alpha' }, pallet: 4 },
    { company: { id: 'b', name: 'Beta' }, pallet: 2 },
    { company: { id: 'c', name: 'Gamma' }, pallet: 1 },
  ]

  beforeEach(() => {
    mockFacebookUrl = ''
  })

  it('renderizza share button e icone social', () => {
    const { container } = render(
      <ActionBar companies={companies} text="ciao" url="https://x" />
    )
    expect(screen.getByRole('button', { name: /condividi/i })).toBeTruthy()
    const igLink = container.querySelector('a[href="https://instagram.com/fanta.cer"]')
    expect(igLink).toBeTruthy()
  })

  it('non rende Facebook quando FACEBOOK_URL è vuoto', () => {
    const { container } = render(
      <ActionBar companies={companies} text="ciao" url="https://x" />
    )
    const fbLink = container.querySelector('a[aria-label="Facebook"]')
    expect(fbLink).toBeNull()
  })

  it('rende Facebook quando FACEBOOK_URL è valorizzato', () => {
    mockFacebookUrl = 'https://facebook.com/fantacer'
    const { container } = render(
      <ActionBar companies={companies} text="ciao" url="https://x" />
    )
    const fbLink = container.querySelector('a[aria-label="Facebook"]')
    expect(fbLink).toBeTruthy()
  })
})
