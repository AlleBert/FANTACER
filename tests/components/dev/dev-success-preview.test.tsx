import { render, waitFor } from '@testing-library/react'
import { VoteProvider, useVote } from '@/lib/VoteContext'
import { DevSuccessPreview, parseDevPreview } from '@/components/dev/dev-success-preview'

const mockCompanies = [
  { id: 'c1', name: 'Alpha SRL' },
  { id: 'c2', name: 'Beta SpA' },
  { id: 'c3', name: 'Gamma SAS' },
]

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ data: mockCompanies }),
          }),
        }),
      }),
    }),
  }),
}))

function Probe() {
  const { gameUnlock, selectedCompanies } = useVote()
  return (
    <div>
      <span data-testid="probe-success">{String(gameUnlock.success)}</span>
      <span data-testid="probe-companies">
        {selectedCompanies.map((c) => c.company.name).join('|')}
      </span>
    </div>
  )
}

function setup(search: string) {
  window.history.replaceState({}, '', search)
  return render(
    <VoteProvider>
      <DevSuccessPreview />
      <Probe />
    </VoteProvider>
  )
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ activeBatch: 'TEST' }),
  })
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
  jest.restoreAllMocks()
})

describe('parseDevPreview', () => {
  it('nessun parametro -> nessuna azione', () => {
    expect(parseDevPreview('')).toEqual({ success: false, companies: false })
    expect(parseDevPreview('?foo=bar')).toEqual({ success: false, companies: false })
  })

  it('?dev_success=1 -> success attivo', () => {
    expect(parseDevPreview('?dev_success=1')).toEqual({ success: true, companies: false })
  })

  it('?dev_companies=1 -> companies attivo', () => {
    expect(parseDevPreview('?dev_companies=1')).toEqual({ success: false, companies: true })
  })

  it('parametri combinati', () => {
    expect(parseDevPreview('?dev_success=1&dev_companies=1')).toEqual({
      success: true,
      companies: true,
    })
  })
})

describe('DevSuccessPreview', () => {
  it('senza parametri non sblocca nulla', async () => {
    setup('/')
    expect(document.querySelector('[data-testid="probe-success"]')?.textContent).toBe('false')
    expect(document.querySelector('[data-testid="probe-companies"]')?.textContent).toBe('')
  })

  it('?dev_success=1 sblocca la sezione di successo', async () => {
    setup('/?dev_success=1')
    await waitFor(() =>
      expect(document.querySelector('[data-testid="probe-success"]')?.textContent).toBe('true')
    )
  })

  it('?dev_companies=1 pre-seleziona le prime 3 aziende del batch', async () => {
    setup('/?dev_companies=1')
    await waitFor(() =>
      expect(document.querySelector('[data-testid="probe-companies"]')?.textContent).toBe(
        'Alpha SRL|Beta SpA|Gamma SAS'
      )
    )
  })

  it('in produzione (NODE_ENV=production) i parametri sono inerti', async () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production')
    setup('/?dev_success=1&dev_companies=1')
    expect(document.querySelector('[data-testid="probe-success"]')?.textContent).toBe('false')
    expect(document.querySelector('[data-testid="probe-companies"]')?.textContent).toBe('')
  })
})