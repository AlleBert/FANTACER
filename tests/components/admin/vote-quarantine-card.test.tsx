import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoteQuarantineCard } from '@/components/admin/vote-quarantine-card'

jest.mock('@/lib/use-admin-role', () => ({
  useAdminRole: () => (globalThis as { __role?: string }).__role ?? 'admin',
}))

const response = {
  success: true,
  counts: { accepted: 10, quarantined: 2, rejected: 1, total: 13 },
  byDay: [],
  votes: [
    {
      id: '42',
      createdAt: '2026-09-24T10:00:00Z',
      status: 'quarantined',
      fingerprint: 'v2:principal-42',
      country: 'IT',
      reviewActor: null,
      reviewedAt: null,
      reviewReason: 'Correlazione sospetta',
      riskFindings: { ip_hmac: 'hmac-abc' },
    },
  ],
}

function mockFetch() {
  return jest.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/votes/quarantine' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ success: true, changed: true }) }
    }
    if (url === '/api/admin/votes/quarantine') {
      return { ok: true, json: async () => response }
    }
    if (url === '/api/admin/votes/reconcile') {
      return { ok: true, json: async () => ({ success: true, changed: true, companies_changed: 3 }) }
    }
    throw new Error('unexpected url ' + url)
  })
}

const postBody = () => {
  const call = (global.fetch as jest.Mock).mock.calls.find(
    ([url, init]) => url === '/api/admin/votes/quarantine' && (init as RequestInit)?.method === 'POST',
  )
  return call ? JSON.parse((call[1] as RequestInit).body as string) : null
}

describe('VoteQuarantineCard', () => {
  beforeEach(() => {
    ;(globalThis as { __role?: string }).__role = 'admin'
    global.fetch = mockFetch() as unknown as typeof fetch
  })

  it('mostra i conteggi e i voti in quarantena', async () => {
    render(<VoteQuarantineCard />)

    expect(await screen.findByText('Correlazione sospetta')).toBeInTheDocument()
    expect(screen.getByTestId('count-accepted')).toHaveTextContent('10')
    expect(screen.getByTestId('count-quarantined')).toHaveTextContent('2')
    expect(screen.getByTestId('count-rejected')).toHaveTextContent('1')
    expect(screen.getByTestId('count-total')).toHaveTextContent('13')
  })

  it('Accetta chiama il POST con voteId e status accepted', async () => {
    render(<VoteQuarantineCard />)
    await screen.findByText('Correlazione sospetta')

    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }))

    await waitFor(() => expect(postBody()).toEqual({ voteId: '42', status: 'accepted' }))
  })

  it('Rifiuta chiama il POST con status rejected', async () => {
    render(<VoteQuarantineCard />)
    await screen.findByText('Correlazione sospetta')

    fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }))

    await waitFor(() => expect(postBody()).toEqual({ voteId: '42', status: 'rejected' }))
  })

  it('Riconcilia totali chiama il POST /reconcile', async () => {
    render(<VoteQuarantineCard />)
    await screen.findByText('Correlazione sospetta')

    fireEvent.click(screen.getByRole('button', { name: 'Riconcilia totali' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/votes/reconcile', { method: 'POST' }),
    )
  })

  it('viewer è read-only: pulsanti disabilitati', async () => {
    ;(globalThis as { __role?: string }).__role = 'viewer'
    render(<VoteQuarantineCard />)
    await screen.findByText('Correlazione sospetta')

    expect(screen.getByRole('button', { name: 'Accetta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rifiuta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Riconcilia totali' })).toBeDisabled()
  })

  it('mostra errore inline quando il POST fallisce', async () => {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/votes/quarantine' && init?.method === 'POST') {
        return { ok: false, json: async () => ({ error: 'Stato non valido' }) }
      }
      return { ok: true, json: async () => response }
    }) as unknown as typeof fetch

    render(<VoteQuarantineCard />)
    await screen.findByText('Correlazione sospetta')

    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }))

    expect(await screen.findByText('Stato non valido')).toBeInTheDocument()
  })
})
