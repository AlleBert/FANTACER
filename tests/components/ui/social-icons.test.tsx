import { render } from '@testing-library/react'
import { InstagramIcon, FacebookIcon } from '@/components/ui/social-icons'

describe('social-icons', () => {
  it('InstagramIcon rende uno svg con rect e path', () => {
    const { container } = render(<InstagramIcon className="h-5 w-5" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('h-5 w-5')
    expect(svg?.querySelector('rect')).toBeTruthy()
    expect(svg?.querySelector('path')).toBeTruthy()
  })

  it('FacebookIcon rende uno svg con path e nessun rect', () => {
    const { container } = render(<FacebookIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.querySelector('path')).toBeTruthy()
    expect(svg?.querySelector('rect')).toBeNull()
  })
})
