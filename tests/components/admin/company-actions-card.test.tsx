import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  CompanyActionsCard,
  buildActionPayload,
} from '@/components/admin/company-actions-card'

jest.mock('@/hooks/use-batches', () => ({
  useBatches: () => ({ batches: [], activeBatch: 'B1', loading: false }),
}))
jest.mock('@/lib/use-admin-role', () => ({
  useAdminRole: () => (globalThis as { __role?: string }).__role ?? 'admin',
}))

const companies = [
  { id: 'refin', name: 'REFIN', blocked: false, manualScore: false },
  { id: 'dts', name: 'REFIN-DTS-CITY', blocked: true, manualScore: false },
  { id: 'mar', name: 'MARINER', blocked: false, manualScore: true },
]

const preview = {
  before: [
    { id: 'refin', name: 'REFIN', pallets: 100, votes: 30, rank: 1 },
    { id: 'mar', name: 'MARINER', pallets: 80, votes: 20, rank: 2 },
  ],
  after: [
    { id: 'mar', name: 'MARINER', pallets: 80, votes: 20, rank: 1 },
  ],
  impact: { sessionsDeleted: 0, palletsBefore: {}, palletsAfter: {}, selected: ['refin'] },
}

function mockFetch() {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/admin/companies/preview')) {
      return { ok: true, json: async () => preview }
    }
    if (url.startsWith('/api/admin/companies/apply')) {
      return { ok: true, json: async () => ({ success: true }) }
    }
    if (url.startsWith('/api/admin/companies/backup/create')) {
      return { ok: true, json: async () => ({ success: true, backup: { backup_id: 3 } }) }
    }
    if (url.startsWith('/api/admin/companies/backup')) {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true, restored: 1 }) }
      }
      if (url.includes('?id=2')) {
        return { ok: true, json: async () => ({ data: { id: 2, payload: [] } }) }
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 2,
              created_at: '2026-09-24T07:17:37Z',
              label: 'backup 1 aziende',
              batch: 'cersal',
              company_ids: ['a'],
            },
          ],
        }),
      }
    }
    return { ok: true, json: async () => ({ data: companies }) }
  })
}

describe('buildActionPayload', () => {
  it('delete-votes', () => {
    expect(buildActionPayload(['a'], 'delete-votes', { pallets: 0, votes: 0, unblockMode: 'keep' })).toEqual({
      companyIds: ['a'],
      deleteVotes: true,
    })
  })
  it('set-score', () => {
    expect(
      buildActionPayload(['a'], 'set-score', { pallets: 10, votes: 5, unblockMode: 'keep' }),
    ).toEqual({ companyIds: ['a'], score: { pallets: 10, votes: 5 } })
  })
  it('unblock zero', () => {
    expect(
      buildActionPayload(['a'], 'unblock', { pallets: 10, votes: 5, unblockMode: 'zero' }),
    ).toEqual({ companyIds: ['a'], blocked: false, score: { pallets: 0, votes: 0 } })
  })
  it('clear-score', () => {
    expect(buildActionPayload(['a'], 'clear-score', { pallets: 0, votes: 0, unblockMode: 'keep' })).toEqual({
      companyIds: ['a'],
      score: null,
    })
  })
})

describe('CompanyActionsCard', () => {
  beforeEach(() => {
    ;(globalThis as { __role?: string }).__role = 'admin'
    global.fetch = mockFetch() as unknown as typeof fetch
  })

  it('mostra le aziende e i badge', async () => {
    render(<CompanyActionsCard />)
    expect(await screen.findByText('REFIN')).toBeInTheDocument()
    expect(screen.getByText('bloccata')).toBeInTheDocument()
    expect(screen.getByText('punteggio manuale')).toBeInTheDocument()
  })

  it('Anteprima chiama /preview e mostra la modale', async () => {
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    fireEvent.click(screen.getByLabelText('Seleziona REFIN'))
    fireEvent.click(screen.getByRole('button', { name: 'Anteprima' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/companies/preview',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Cancella voti')
    expect(dialog).toHaveTextContent('MARINER')
  })

  it('Conferma chiama /apply', async () => {
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    fireEvent.click(screen.getByLabelText('Seleziona REFIN'))
    fireEvent.click(screen.getByRole('button', { name: 'Anteprima' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Conferma' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/companies/apply',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('viewer non vede i controlli azione', async () => {
    ;(globalThis as { __role?: string }).__role = 'viewer'
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    expect(screen.queryByRole('button', { name: 'Anteprima' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Seleziona REFIN')).not.toBeInTheDocument()
  })

  it('la sezione Backup elenca i backup quando aperta', async () => {
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    fireEvent.click(screen.getByRole('button', { name: /Backup/i }))
    expect(await screen.findByText('backup 1 aziende')).toBeInTheDocument()
  })

  it('Ripristina chiama POST /api/admin/companies/backup', async () => {
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    fireEvent.click(screen.getByRole('button', { name: /Backup/i }))
    await screen.findByText('backup 1 aziende')
    fireEvent.click(screen.getByRole('button', { name: 'Ripristina' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/companies/backup',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('viewer non vede il pulsante Ripristina', async () => {
    ;(globalThis as { __role?: string }).__role = 'viewer'
    render(<CompanyActionsCard />)
    await screen.findByText('REFIN')
    fireEvent.click(screen.getByRole('button', { name: /Backup/i }))
    await screen.findByText('backup 1 aziende')
    expect(screen.queryByRole('button', { name: 'Ripristina' })).not.toBeInTheDocument()
    ;(globalThis as { __role?: string }).__role = 'admin'
  })
})
