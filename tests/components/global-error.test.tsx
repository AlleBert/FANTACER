import { render, screen } from '@testing-library/react'
import GlobalError from '@/app/global-error'

describe('GlobalError', () => {
  it('mostra l\'errore 500 senza dipendere da Sentry', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<GlobalError error={new Error('boom')} />)
    expect(screen.getByText('500')).toBeTruthy()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})