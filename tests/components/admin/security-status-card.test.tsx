import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecurityStatusCard } from '@/components/admin/security-status-card'

jest.mock('@/lib/use-admin-role', () => ({
  useAdminRole: () => (globalThis as { __role?: string }).__role ?? 'admin',
}))

const baseResponse = {
  identityMode: 'dual',
  nonces: {
    total: 10,
    consumed: 4,
    expired: 3,
    outstanding: 3,
    suspiciousOutstanding: false,
  },
  totalsDrift: { drift: 0, aligned: true },
  voteHealth: { ok: true, kind: 'json' },
}

function mockFetch(body: unknown = baseResponse, ok = true) {
  return jest.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch
}

async function renderCard() {
  render(<SecurityStatusCard />)
  return screen.findByTestId('identity-mode')
}

describe('SecurityStatusCard', () => {
  beforeEach(() => {
    ;(globalThis as { __role?: string }).__role = 'admin'
    global.fetch = mockFetch()
  })

  it('mostra la modalità identità con spiegazione', async () => {
    await renderCard()

    expect(screen.getByTestId('identity-mode')).toHaveTextContent('dual')
    expect(screen.getByText(/dual-read/i)).toBeInTheDocument()
  })

  it('badge totali allineati', async () => {
    await renderCard()

    expect(screen.getByTestId('drift-badge')).toHaveTextContent(/allineat/i)
  })

  it('badge totali divergenti con delta e nota riconciliazione', async () => {
    global.fetch = mockFetch({
      ...baseResponse,
      totalsDrift: { drift: 6, aligned: false },
    })

    await renderCard()

    expect(screen.getByTestId('drift-badge')).toHaveTextContent(/divergen/i)
    expect(screen.getByText(/Riconcilia totali/i)).toBeInTheDocument()
  })

  it('badge salute voto verde su JSON', async () => {
    await renderCard()

    expect(screen.getByTestId('vote-health-badge')).toHaveTextContent(/ok/i)
  })

  it('badge salute voto rosso su HTML', async () => {
    global.fetch = mockFetch({
      ...baseResponse,
      voteHealth: { ok: false, kind: 'html' },
    })

    await renderCard()

    expect(screen.getByTestId('vote-health-badge')).toHaveTextContent(/anomalia/i)
  })

  it('mostra i conteggi nonce', async () => {
    await renderCard()

    expect(screen.getByTestId('nonces-total')).toHaveTextContent('10')
    expect(screen.getByTestId('nonces-consumed')).toHaveTextContent('4')
    expect(screen.getByTestId('nonces-expired')).toHaveTextContent('3')
    expect(screen.getByTestId('nonces-outstanding')).toHaveTextContent('3')
    expect(screen.queryByTestId('nonces-warning')).not.toBeInTheDocument()
  })

  it('avvisa quando gli outstanding sono sospetti', async () => {
    global.fetch = mockFetch({
      ...baseResponse,
      nonces: {
        total: 100,
        consumed: 20,
        expired: 10,
        outstanding: 70,
        suspiciousOutstanding: true,
      },
    })

    await renderCard()

    expect(screen.getByTestId('nonces-warning')).toBeInTheDocument()
  })

  it('degrada una sezione in errore senza nascondere le altre', async () => {
    global.fetch = mockFetch({
      ...baseResponse,
      nonces: { error: 'unavailable' },
    })

    await renderCard()

    expect(screen.getByText(/nonce non disponibile/i)).toBeInTheDocument()
    expect(screen.getByTestId('drift-badge')).toHaveTextContent(/allineat/i)
  })

  it('mostra errore inline quando la fetch fallisce', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    render(<SecurityStatusCard />)

    expect(await screen.findByText(/errore/i)).toBeInTheDocument()
  })

  it('ricarica manualmente i dati', async () => {
    await renderCard()

    fireEvent.click(screen.getByRole('button', { name: /ricarica/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('viewer è read-only: nessun controllo di scrittura', async () => {
    ;(globalThis as { __role?: string }).__role = 'viewer'

    await renderCard()

    expect(screen.getByTestId('identity-mode')).toHaveTextContent('dual')
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName(/ricarica/i)
  })
})
