import { render, screen, fireEvent, act } from '@testing-library/react'
import { AdminThemeProvider, useAdminTheme } from '@/components/admin/admin-theme-provider'

/**
 * Regressione: su browser mobile con storage bloccato (Safari private browsing,
 * "Prevent Cross-Site Tracking", in-app browser) `localStorage` access lancia
 * `SecurityError`. Il crash durante il render del provider faceva scattare il
 * boundary globale `global-error.tsx` → pagina "500 Internal Server Error"
 * (client-side, con HTTP 200 dal server).
 */

function StorageThrowing() {
  const { theme, toggleTheme } = useAdminTheme()
  return (
    <button onClick={toggleTheme} aria-label="toggle">
      {theme}
    </button>
  )
}

describe('AdminThemeProvider', () => {
  const realGetItem = Storage.prototype.getItem
  const realSetItem = Storage.prototype.setItem
  const realRemoveItem = Storage.prototype.removeItem

  afterEach(() => {
    Storage.prototype.getItem = realGetItem
    Storage.prototype.setItem = realSetItem
    Storage.prototype.removeItem = realRemoveItem
  })

  function blockStorage() {
    Storage.prototype.getItem = function () {
      throw new Error('The operation is insecure.')
    }
    Storage.prototype.setItem = function () {
      throw new Error('The operation is insecure.')
    }
    Storage.prototype.removeItem = function () {
      throw new Error('The operation is insecure.')
    }
  }

  // Il provider fa setMounted(true) in un queueMicrotask dentro useEffect:
  // serve flushare il microtask dentro act per evitare il warning "not wrapped in act".
  async function renderProvider(node: React.ReactNode) {
    render(<AdminThemeProvider>{node}</AdminThemeProvider>)
    await act(async () => {})
  }

  it('renders children when localStorage.getItem throws (mobile blocked storage)', async () => {
    blockStorage()
    await renderProvider(<div>pannello admin</div>)
    expect(screen.getByText('pannello admin')).toBeInTheDocument()
  })

  it('defaults to light theme when storage is unavailable', async () => {
    blockStorage()
    await renderProvider(<StorageThrowing />)
    expect(screen.getByRole('button', { name: 'toggle' })).toHaveTextContent('light')
  })

  it('does not throw when toggling theme with localStorage.setItem throwing', async () => {
    blockStorage()
    await renderProvider(<StorageThrowing />)
    const toggle = screen.getByRole('button', { name: 'toggle' })
    expect(() => fireEvent.click(toggle)).not.toThrow()
  })

  it('persists the theme when storage is available', async () => {
    await renderProvider(<StorageThrowing />)
    const toggle = screen.getByRole('button', { name: 'toggle' })
    fireEvent.click(toggle)
    expect(localStorage.getItem('admin-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'toggle' })).toHaveTextContent('dark')
  })
})