/**
 * @jest-environment node
 */
import { GET } from '../src/app/api/share/vote/route'
import { translate } from '../src/i18n'

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

const mockCreateAdminClient = jest.requireMock('@/lib/supabase/admin').createAdminClient as jest.Mock

// ImageResponse (Satori) è pesante e nativo: lo mockiamo per verificare che la
// route lo invochi con il JSX e le opzioni giuste e che gestisca input/errore.
// NB: jest.fn() è constructable (regola funzione, non arrow) perché la route
// usa `new ImageResponse(...)`. La factory NON può referenziare const esterne
// (jest la hoista): è autosufficiente.
jest.mock('next/og', () => ({
  ImageResponse: jest.fn(),
}))

const mockImageResponseMock = jest.requireMock('next/og').ImageResponse as jest.Mock

function setupImageResponse() {
  mockImageResponseMock.mockReturnValue(
    new Response('png-bytes', { headers: { 'content-type': 'image/png' } })
  )
}

const COMPANIES = [
  { id: 'c1', name: 'Alpha SRL' },
  { id: 'c2', name: 'Beta SpA' },
  { id: 'c3', name: 'Gamma SAS' },
]

function buildSupabase() {
  const companiesChain = {
    select: jest.fn(() => ({ in: jest.fn(async () => ({ data: COMPANIES, error: null })) })),
  }
  const from = jest.fn(() => companiesChain)
  return { from }
}

function req(query: string): Request {
  return new Request(`http://localhost/api/share/vote${query}`)
}

describe('GET /api/share/vote', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateAdminClient.mockReturnValue(buildSupabase())
    setupImageResponse()
  })

  it('risponde 400 se mancano i parametri', async () => {
    const res = await GET(req('?c1=a&c2=b'))
    expect(res.status).toBe(400)
    expect(mockImageResponseMock).not.toHaveBeenCalled()
  })

  it('risponde 400 se un pallet non è valido', async () => {
    const res = await GET(req('?c1=a&c2=b&c3=c&p1=5&p2=2&p3=1'))
    expect(res.status).toBe(400)
  })

  it('risponde 400 se le aziende non vengono trovate', async () => {
    const chain = {
      select: jest.fn(() => ({ in: jest.fn(async () => ({ data: null, error: null })) })),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn(() => chain),
    })
    const res = await GET(req('?c1=a&c2=b&c3=c&p1=4&p2=2&p3=1'))
    expect(res.status).toBe(400)
  })

  it("genera l'immagine 1080×1920 (9:16) con le aziende e i pallet, senza sponsor", async () => {
    const supabase = buildSupabase()
    mockCreateAdminClient.mockReturnValue(supabase)
    const res = await GET(req('?c1=c1&c2=c2&c3=c3&p1=4&p2=2&p3=1&lang=it'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')

    // ImageResponse invocato con (jsx, options)
    const [, options] = mockImageResponseMock.mock.calls[0]
    expect(options.width).toBe(1080)
    expect(options.height).toBe(1920)
    expect(options.fonts.length).toBeGreaterThanOrEqual(1)

    // Il JSX contiene i nomi aziende e i pallet
    const jsx = mockImageResponseMock.mock.calls[0][0]
    const str = JSON.stringify(jsx)
    expect(str).toContain('Alpha SRL')
    expect(str).toContain('Beta SpA')
    expect(str).toContain('Gamma SAS')
    expect(str).toContain('4')
    expect(str).toContain('2')
    expect(str).toContain('1')

    // Alleggerita: nessuna query alla tabella sponsors
    expect(supabase.from).toHaveBeenCalledWith('companies')
    expect(supabase.from).not.toHaveBeenCalledWith('sponsors')
  })

  it('usa il copy localizzato (it/en)', async () => {
    await GET(req('?c1=c1&c2=c2&c3=c3&p1=4&p2=2&p3=1&lang=en'))
    const jsx = mockImageResponseMock.mock.calls[0][0]
    const str = JSON.stringify(jsx)
    expect(str).toContain(translate('en', 'success.voted'))
  })
})