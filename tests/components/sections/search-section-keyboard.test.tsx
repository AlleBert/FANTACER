import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchSection } from '@/components/sections/search-section'

jest.mock('@/lib/LocaleContext', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

jest.mock('@/components/voting/turnstile-overlay', () => ({
  TurnstileOverlay: () => null,
}))

jest.mock('@/components/voting/liquid-fill-button', () => ({
  LiquidFillButton: () => null,
}))

const mockVote = {
  selectedCompanies: [] as Array<{ company: { id: string; name: string }; pallet: number }>,
  setCompany: jest.fn(),
  removeCompany: jest.fn(),
  setPallet: jest.fn(),
  usedPallets: () => [] as number[],
  unlockGameStep: jest.fn(),
  gameUnlock: { success: false },
}

jest.mock('@/lib/VoteContext', () => ({
  useVote: () => mockVote,
}))

jest.mock('@/lib/RealtimeContext', () => ({
  useRealtime: () => ({ votingEnabled: true }),
}))

jest.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: (...args: string[]) => unknown) => fn,
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
      subscribe: () => ({ unsubscribe: jest.fn() }),
    }),
    removeChannel: jest.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            limit: () => Promise.resolve({ data: [{ id: 'c1', name: 'Alpha' }] }),
          }),
        }),
      }),
    }),
  }),
}))

beforeEach(() => {
  mockVote.selectedCompanies = []
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/public/batch')) {
      return Promise.resolve({ json: async () => ({ activeBatch: 'B1' }) })
    }
    if (url.includes('/api/public/flag/voting')) {
      return Promise.resolve({ json: async () => ({ enabled: true }) })
    }
    return Promise.resolve({ json: async () => ({}) })
  }) as unknown as typeof fetch
})

describe('SearchSection — tastiera input', () => {
  it('espone gli attributi per la tastiera di ricerca', () => {
    render(<SearchSection />)
    const input = screen.getByLabelText('search.placeholder') as HTMLInputElement
    expect(input).toHaveAttribute('inputmode', 'search')
    expect(input).toHaveAttribute('enterkeyhint', 'search')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('al select di un risultato fa blur dell\'input e apre il pallet picker', async () => {
    render(<SearchSection />)
    const input = screen.getByLabelText('search.placeholder') as HTMLInputElement

    input.focus()
    expect(document.activeElement).toBe(input)

    fireEvent.change(input, { target: { value: 'Al' } })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    })

    expect(input).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }))

    expect(document.activeElement).not.toBe(input)
    expect(await screen.findByText('search.assignPallet')).toBeInTheDocument()
  })

  it('naviga i risultati con le frecce e seleziona con Enter', async () => {
    render(<SearchSection />)
    const input = screen.getByLabelText('search.placeholder') as HTMLInputElement

    input.focus()
    fireEvent.change(input, { target: { value: 'Al' } })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(input.getAttribute('aria-activedescendant')).toContain('-opt-0')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(document.activeElement).not.toBe(input)
    expect(await screen.findByText('search.assignPallet')).toBeInTheDocument()
  })
})
