import { render, act } from '@testing-library/react'
import { PrizeLocationSection } from '@/components/sections/prize-location-section'

const mockHolder = {
  cb: null as (() => void) | null,
  subscribe: jest.fn(),
  removeChannel: jest.fn(),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: (_e: string, _o: unknown, cb: () => void) => {
        mockHolder.cb = cb
        return { subscribe: mockHolder.subscribe }
      },
    }),
    removeChannel: mockHolder.removeChannel,
  }),
}))

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

const receivedProps: Array<Record<string, unknown>> = []
jest.mock('@/components/sponsor/sponsor-cards', () => ({
  SponsorCards: (props: Record<string, unknown>) => {
    receivedProps.push(props)
    return null
  },
}))

describe('PrizeLocationSection', () => {
  beforeEach(() => {
    receivedProps.length = 0
  })

  it('usa SponsorCards variant=large + standOnly', () => {
    render(<PrizeLocationSection />)
    expect(receivedProps[0].variant).toBe('large')
    expect(receivedProps[0].standOnly).toBe(true)
    expect(receivedProps[0].refreshKey).toBe(0)
  })

  it('si sottoscrive alla tabella sponsors', () => {
    render(<PrizeLocationSection />)
    expect(mockHolder.subscribe).toHaveBeenCalled()
  })

  it('fa bump di refreshKey al cambio realtime', async () => {
    render(<PrizeLocationSection />)
    await act(async () => {
      mockHolder.cb?.()
    })
    expect(receivedProps[1].refreshKey).toBe(1)
  })
})
