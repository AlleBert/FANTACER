import {
  ensureSession,
  csrfFetch,
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
  type BootstrapTokenProvider,
} from '@/lib/session-client'
import { VOTER_COOKIE } from '@/lib/vote-identity'

const CDATA = 'bootstrap:nonce-1234567890abcdef'
const STORED_ID = '11111111-2222-4333-8444-555555555555'

function readVoterCookie(): string | null {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${VOTER_COOKIE}=`))
  return entry ? decodeURIComponent(entry.slice(VOTER_COOKIE.length + 1)) : null
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

function setFetch(...responses: Response[]) {
  const mock = jest.fn()
  for (const response of responses) mock.mockResolvedValueOnce(response)
  global.fetch = mock as unknown as typeof fetch
  return mock
}

let provider: jest.Mock

beforeEach(() => {
  clearCsrfToken()
  provider = jest.fn()
  document.cookie = `${VOTER_COOKIE}=; Max-Age=0; Path=/`
  localStorage.clear()
})

describe('csrf token store', () => {
  it('get/set/clear', () => {
    expect(getCsrfToken()).toBeNull()
    setCsrfToken('abc')
    expect(getCsrfToken()).toBe('abc')
    clearCsrfToken()
    expect(getCsrfToken()).toBeNull()
  })

  it('ignora un set vuoto', () => {
    setCsrfToken('abc')
    setCsrfToken('')
    expect(getCsrfToken()).toBe('abc')
  })
})

describe('ensureSession', () => {
  it('su successo salva il csrf token e invia token + cData', async () => {
    const fetchMock = setFetch(
      jsonResponse({ nonce: 'n-1', cData: CDATA }),
      jsonResponse({ ok: true, csrfToken: 'csrf-123' }),
    )
    provider.mockResolvedValue({ token: 'ts-token', cData: CDATA })

    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(true)
    expect(getCsrfToken()).toBe('csrf-123')
    expect(provider).toHaveBeenCalledWith(CDATA)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/identity/bootstrap/nonce')
    const postCall = fetchMock.mock.calls[1]
    expect(postCall[0]).toBe('/api/identity/bootstrap')
    expect(postCall[1].method).toBe('POST')
    expect(JSON.parse(postCall[1].body)).toEqual({ turnstile_token: 'ts-token', cData: CDATA })
  })

  it('è un no-op quando esiste già un token (nessuna richiesta)', async () => {
    setCsrfToken('already')
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(provider).not.toHaveBeenCalled()
  })

  it('ritorna false se il nonce endpoint non è disponibile (identità off)', async () => {
    const fetchMock = setFetch(jsonResponse({ ok: false }, false, 404))
    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(false)
    expect(getCsrfToken()).toBeNull()
    expect(provider).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ritorna false se il provider non produce un token', async () => {
    setFetch(jsonResponse({ nonce: 'n-1', cData: CDATA }))
    provider.mockResolvedValue(null)

    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(false)
    expect(getCsrfToken()).toBeNull()
  })

  it('ritorna false se il bootstrap fallisce', async () => {
    setFetch(
      jsonResponse({ nonce: 'n-1', cData: CDATA }),
      jsonResponse({ error: 'Forbidden' }, false, 403),
    )
    provider.mockResolvedValue({ token: 'ts-token', cData: CDATA })

    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(false)
    expect(getCsrfToken()).toBeNull()
  })

  it('ritorna false se la risposta bootstrap non contiene csrfToken', async () => {
    setFetch(jsonResponse({ nonce: 'n-1', cData: CDATA }), jsonResponse({ ok: true }))
    provider.mockResolvedValue({ token: 'ts-token', cData: CDATA })

    expect(await ensureSession(provider as BootstrapTokenProvider)).toBe(false)
    expect(getCsrfToken()).toBeNull()
  })

  it('ritorna false su errore di rete, senza lanciare', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
    const ok = await ensureSession(provider as BootstrapTokenProvider)

    expect(ok).toBe(false)
    expect(getCsrfToken()).toBeNull()
  })

  it('bridga localStorage → cookie legacy prima del bootstrap', async () => {
    localStorage.setItem('fantacer_voter_id', STORED_ID)
    const fetchMock = setFetch(
      jsonResponse({ nonce: 'n-1', cData: CDATA }),
      jsonResponse({ ok: true, csrfToken: 'csrf-123' }),
    )
    provider.mockResolvedValue({ token: 'ts-token', cData: CDATA })

    expect(await ensureSession(provider as BootstrapTokenProvider)).toBe(true)
    expect(readVoterCookie()).toBe(STORED_ID)
    // Il cookie è già stato scritto prima della prima richiesta di bootstrap.
    expect(fetchMock.mock.calls[0][0]).toBe('/api/identity/bootstrap/nonce')
  })
})

describe('csrfFetch', () => {
  it('aggiunge X-CSRF-Token quando il token esiste', async () => {
    setCsrfToken('csrf-xyz')
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}))
    global.fetch = fetchMock as unknown as typeof fetch

    await csrfFetch('/api/vota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/vota')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'csrf-xyz',
    })
    expect(init.body).toBe('{}')
  })

  it('non aggiunge header quando il token è assente (legacy)', async () => {
    clearCsrfToken()
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}))
    global.fetch = fetchMock as unknown as typeof fetch

    await csrfFetch('/api/vota/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers).not.toHaveProperty('X-CSRF-Token')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('non sovrascrive un header esplicito del chiamante', async () => {
    setCsrfToken('store-token')
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}))
    global.fetch = fetchMock as unknown as typeof fetch

    await csrfFetch('/api/vota', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'caller-token' },
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-CSRF-Token']).toBe('caller-token')
  })
})
