import { render, screen, waitFor } from '@testing-library/react'
import { SponsorCards } from '@/components/sponsor/sponsor-cards'
import { resetSponsorsCache } from '@/lib/sponsors'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))

const BASE = [
  { id: '1', name: 'Alpha', image_url: null, website_url: 'https://alpha.it', has_stand: true },
  { id: '2', name: 'Beta', image_url: 'https://img/beta.png', website_url: null, has_stand: false },
  { id: '3', name: 'Gamma', image_url: null, website_url: null, has_stand: true },
  { id: '4', name: 'Delta', image_url: null, website_url: null, has_stand: false },
]

const mockFetch = jest.fn()

beforeEach(() => {
  resetSponsorsCache()
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sponsors: BASE }) } as Response)
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  mockFetch.mockReset()
  resetSponsorsCache()
  delete (global as { fetch?: unknown }).fetch
})

describe('SponsorCards', () => {
  it('chiama /api/public/sponsors e rende un link per website_url, un div altrimenti', async () => {
    render(<SponsorCards />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/public/sponsors'))
    const alpha = await screen.findByText('Alpha')
    const link = alpha.closest('a')
    expect(link).not.toBeNull()
    expect(link).toHaveAttribute('href', 'https://alpha.it')
    expect(link).toHaveAttribute('target', '_blank')
    const gamma = screen.getByText('Gamma')
    expect(gamma.closest('a')).toBeNull()
    expect(screen.getByAltText('Beta')).toBeTruthy()
  })

  it('usa la size var del conteggio (2 sponsor → --sponsor-card-2)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sponsors: BASE.slice(0, 2) }) } as Response)
    render(<SponsorCards />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-size')).toContain('--sponsor-card-2'))
  })

  it('con 1 sponsor usa --sponsor-card-1', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sponsors: BASE.slice(0, 1) }) } as Response)
    render(<SponsorCards />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-size')).toContain('--sponsor-card-1'))
  })

  it('con 4 sponsor usa --sponsor-card-4', async () => {
    render(<SponsorCards />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-size')).toContain('--sponsor-card-4'))
  })

  it('con variant compact applica --sponsor-scale-compact', async () => {
    render(<SponsorCards variant="compact" />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-scale')).toBe('var(--sponsor-scale-compact)'))
  })

  it('con variant large applica --sponsor-scale-large', async () => {
    render(<SponsorCards variant="large" />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-scale')).toBe('var(--sponsor-scale-large)'))
  })

  it('applica size var, scale e cap di altezza (--sponsor-card-maxh) alla card', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sponsors: BASE.slice(0, 2) }) } as Response)
    render(<SponsorCards />)
    const alpha = await screen.findByText('Alpha')
    const el = alpha.closest('a') as HTMLElement
    const size = 'calc(var(--sponsor-size) * var(--sponsor-scale))'
    await waitFor(() => expect(el.style.getPropertyValue('--sponsor-size')).toContain('--sponsor-card-2'))
    expect(el.style.getPropertyValue('--sponsor-scale')).toBe('1')
    expect(el.style.maxWidth).toBe(`min(${size}, var(--sponsor-card-maxh))`)
    expect(el.style.maxHeight).toBe('var(--sponsor-card-maxh)')
  })

  it('il skeleton applica size var, scale e cap di altezza', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { container } = render(<SponsorCards />)
    const sk = container.querySelector('.animate-pulse') as HTMLElement
    expect(sk.style.getPropertyValue('--sponsor-size')).toContain('--sponsor-card-4')
    expect(sk.style.maxHeight).toBe('var(--sponsor-card-maxh)')
  })

  it('con standOnly filtra has_stand', async () => {
    render(<SponsorCards standOnly />)
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeNull())
    expect(screen.queryByText('Beta')).toBeNull()
    expect(screen.queryByText('Gamma')).not.toBeNull()
    expect(screen.queryByText('Delta')).toBeNull()
  })

  it('senza sponsor non renderizza nulla', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sponsors: [] }) } as Response)
    const { container } = render(<SponsorCards />)
    await waitFor(() => expect(container.querySelector('.rounded-2xl')).toBeNull())
  })

  it('al cambio di refreshKey rifetcha', async () => {
    const { rerender } = render(<SponsorCards refreshKey={0} />)
    await screen.findByText('Alpha')
    rerender(<SponsorCards refreshKey={1} />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
  })

  it('mostra skeleton di 4 placeholder in loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { container } = render(<SponsorCards />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('propaga className al container', async () => {
    const { container } = render(<SponsorCards className="mt-4" />)
    await screen.findByText('Alpha')
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('mt-4')
    expect(wrapper.className).toContain('flex-wrap')
  })
})
