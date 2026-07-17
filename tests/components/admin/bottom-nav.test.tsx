import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/components/admin/bottom-nav'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

describe('BottomNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/admin/dashboard/panoramica')
  })

  it('renders all 5 nav items', () => {
    render(<BottomNav />)
    expect(screen.getByText('Panoramica')).toBeInTheDocument()
    expect(screen.getByText('Aziende')).toBeInTheDocument()
    expect(screen.getByText('Voti')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Impostazioni')).toBeInTheDocument()
  })

  it('highlights the active route with aria-current', () => {
    render(<BottomNav />)
    const activeLink = screen.getByText('Panoramica').closest('a')
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('does not set aria-current on inactive routes', () => {
    render(<BottomNav />)
    const inactiveLink = screen.getByText('Aziende').closest('a')
    expect(inactiveLink).not.toHaveAttribute('aria-current')
  })

  it('highlights sub-routes as active', () => {
    mockUsePathname.mockReturnValue('/admin/dashboard/voti/dettaglio')
    render(<BottomNav />)
    const link = screen.getByText('Voti').closest('a')
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('shows all items inactive for unknown routes', () => {
    mockUsePathname.mockReturnValue('/some/unknown/page')
    render(<BottomNav />)
    const links = screen.getAllByRole('tab')
    links.forEach(link => {
      expect(link).not.toHaveAttribute('aria-current')
    })
  })
})
