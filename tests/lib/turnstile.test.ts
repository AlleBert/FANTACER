/**
 * @jest-environment node
 */
import {
  verifyTurnstile,
  isTestTurnstileSecret,
  parseAllowedHostnames,
  TURNSTILE_TIMEOUT_MS,
} from '@/lib/turnstile'

const PROD_SECRET = '0x4AAAAAAA_placeholder_not_a_real_key'
const TEST_SECRET = '1x0000000000000000000000000000000AA'
const ORIGINAL_ENV = { ...process.env }

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = jest.fn()

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('isTestTurnstileSecret / parseAllowedHostnames', () => {
  it('riconosce i testing secret Cloudflare', () => {
    expect(isTestTurnstileSecret(TEST_SECRET)).toBe(true)
    expect(isTestTurnstileSecret('2x0000000000000000000000000000000AA')).toBe(true)
    expect(isTestTurnstileSecret('0x4AAAAAAA_placeholder')).toBe(false)
  })
  it('parsa la allowlist esatta', () => {
    expect(parseAllowedHostnames('www.fantacer.com, fantacer.com')).toEqual([
      'www.fantacer.com',
      'fantacer.com',
    ])
    expect(parseAllowedHostnames(undefined)).toEqual([])
  })
})

describe('verifyTurnstile — fail-closed', () => {
  it('token mancante', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    expect(await verifyTurnstile(undefined)).toEqual({ ok: false, reason: 'missing_token' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('secret assente', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: undefined, NODE_ENV: 'test' })
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'missing_secret' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('testing key in produzione Vercel (preview o prod)', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: TEST_SECRET, NODE_ENV: 'production', VERCEL: '1' })
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'test_key_in_production' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('testing key in produzione Vercel Preview (NODE_ENV=production)', async () => {
    setEnv({
      TURNSTILE_SECRET_KEY: TEST_SECRET,
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
    })
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'test_key_in_production' })
  })

  it('testing key in locale (anche next start, VERCEL assente) → ok, nessuna rete', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: TEST_SECRET, NODE_ENV: 'production', VERCEL: undefined })
    expect(await verifyTurnstile('tok')).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('errore di rete', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockRejectedValue(new TypeError('network down'))
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'network_error' })
  })

  it('timeout (AbortController)', async () => {
    jest.useFakeTimers()
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )
    const promise = verifyTurnstile('tok')
    jest.advanceTimersByTime(TURNSTILE_TIMEOUT_MS + 10)
    expect(await promise).toEqual({ ok: false, reason: 'timeout' })
    jest.useRealTimers()
  })

  it('HTTP non valido', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }))
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'http_error' })
  })

  it('JSON malformato', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockResolvedValue(new Response('not-json', { status: 200 }))
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'invalid_json' })
  })

  it('success=false', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockResolvedValue(jsonResponse({ success: false }))
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'verification_failed' })
  })

  it('action assente o errata', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: PROD_SECRET, NODE_ENV: 'test' })
    fetchMock.mockResolvedValue(jsonResponse({ success: true, hostname: 'www.fantacer.com' }))
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'action_mismatch' })
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, action: 'login', hostname: 'www.fantacer.com' }),
    )
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'action_mismatch' })
  })

  it('hostname errato', async () => {
    setEnv({
      TURNSTILE_SECRET_KEY: PROD_SECRET,
      NODE_ENV: 'test',
      TURNSTILE_ALLOWED_HOSTNAMES: 'www.fantacer.com,fantacer.com',
    })
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, action: 'vote', hostname: 'evil.example.com' }),
    )
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'hostname_not_allowed' })
  })

  it('produzione senza allowlist hostname → fail-closed', async () => {
    setEnv({
      TURNSTILE_SECRET_KEY: PROD_SECRET,
      NODE_ENV: 'production',
      TURNSTILE_ALLOWED_HOSTNAMES: undefined,
    })
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, action: 'vote', hostname: 'www.fantacer.com' }),
    )
    expect(await verifyTurnstile('tok')).toEqual({ ok: false, reason: 'hostname_not_allowed' })
  })

  it('token valido (success, action vote, hostname in allowlist)', async () => {
    setEnv({
      TURNSTILE_SECRET_KEY: PROD_SECRET,
      NODE_ENV: 'production',
      TURNSTILE_ALLOWED_HOSTNAMES: 'www.fantacer.com,fantacer.com',
    })
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, action: 'vote', hostname: 'www.fantacer.com' }),
    )
    expect(await verifyTurnstile('tok')).toEqual({ ok: true })
    // Il secret non deve comparire nell'URL/log; il token sì nel body.
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string
    expect(body).toContain('response=tok')
    expect(body).toContain(encodeURIComponent(PROD_SECRET))
  })

  it('testing key in non-produzione: verifica locale, nessuna rete', async () => {
    setEnv({ TURNSTILE_SECRET_KEY: TEST_SECRET, NODE_ENV: 'test' })
    expect(await verifyTurnstile('tok')).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
