import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Page from '@/app/page'
import { setStoredVoterId } from '@/lib/vote-persistence'
import { VOTER_COOKIE } from '@/lib/vote-identity'
import { __resetVoterIdentityForTests } from '@/lib/vote-client-identity'

const UUID = '11111111-2222-4333-8444-555555555555'

jest.mock('@/lib/device', () => ({ getOrCreateDeviceId: () => 'dev-device' }))
jest.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/sections/hero-section', () => ({ HeroSection: () => null }))
jest.mock('@/components/sections/intro-section', () => ({ IntroSection: () => null }))
jest.mock('@/components/sections/how-it-works-section', () => ({ HowItWorksSection: () => null }))
jest.mock('@/components/sections/play-again-section', () => ({ PlayAgainSection: () => null }))
jest.mock('@/components/sections/search-section', () => ({ SearchSection: () => null }))
jest.mock('@/components/sections/public-ranking-section', () => ({
  PublicRankingSection: () => null,
}))
jest.mock('@/components/sections/live-ranking-section', () => ({ LiveRankingSection: () => null }))
jest.mock('@/components/sections/contact-section', () => ({ ContactSection: () => null }))
jest.mock('@/components/sections/success-section', () => ({
  SuccessSection: () => <div data-testid="success-section">success</div>,
}))
jest.mock('@/components/dev/dev-success-preview', () => ({ DevSuccessPreview: () => null }))

describe('Page — wiring del restore voto', () => {
  afterEach(() => {
    localStorage.clear()
    document.cookie = `${VOTER_COOKIE}=; Max-Age=0; Path=/`
    __resetVoterIdentityForTests()
    jest.restoreAllMocks()
  })

  it('monta la success section quando il server conferma il voto', async () => {
    setStoredVoterId(UUID)
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/vota/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            voted: true,
            voterId: UUID,
            companies: [
              { id: 'c1', name: 'Alpha', pallet: 4 },
              { id: 'c2', name: 'Beta', pallet: 2 },
              { id: 'c3', name: 'Gamma', pallet: 1 },
            ],
          }),
        })
      }
      return Promise.resolve({ json: async () => ({}) })
    }) as unknown as typeof fetch

    render(<Page />)

    await waitFor(() => expect(screen.getByTestId('success-section')).toBeInTheDocument())
  })
})
