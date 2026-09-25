/**
 * @jest-environment node
 */
import { parseKeyring, generateCsrfToken, hashCsrfToken } from '@/lib/session-identity'
import { verifyCsrfForRequest, CSRF_HEADER } from '@/lib/vote-csrf'

const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64')
const keyring = parseKeyring(`k1:${b64(32)}`, 'k1')!

const ORIGIN = 'https://fantacer.test'
const HOST = 'fantacer.test'

interface FakeRequest {
  headers: { get(name: string): string | null }
  nextUrl?: { origin: string }
}

function request(headers: Record<string, string> = {}, nextOrigin?: string): FakeRequest {
  const map: Record<string, string> = { host: HOST, ...headers }
  return {
    headers: { get: (name: string) => map[name.toLowerCase()] ?? null },
    ...(nextOrigin ? { nextUrl: { origin: nextOrigin } } : {}),
  }
}

function session(overrides: { csrfHash?: string | null } = {}) {
  return { csrfHash: hashCsrfToken(generateCsrfToken(), keyring), ...overrides }
}

function sessionFor(csrf: string) {
  return { csrfHash: hashCsrfToken(csrf, keyring) }
}

describe('verifyCsrfForRequest', () => {
  it('token valido + Origin same-origin → ok', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: ORIGIN, [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: true })
  })

  it('header X-CSRF-Token assente → missing', () => {
    const result = verifyCsrfForRequest(request({ origin: ORIGIN }), keyring, session())
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })

  it('token errato → invalid', () => {
    const result = verifyCsrfForRequest(
      request({ origin: ORIGIN, [CSRF_HEADER]: 'wrong-token' }),
      keyring,
      session(),
    )
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('csrf_hash assente nella sessione → invalid', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: ORIGIN, [CSRF_HEADER]: csrf }),
      keyring,
      { csrfHash: null },
    )
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('Origin presente ma diverso → origin', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: 'https://attacker.test', [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: false, reason: 'origin' })
  })

  it('Origin assente → origin (fail-closed)', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: false, reason: 'origin' })
  })

  it('Origin "null" (iframe sandbox) → origin', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: 'null', [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: false, reason: 'origin' })
  })

  it('Origin malformato → origin', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: 'not a url', [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: false, reason: 'origin' })
  })

  it('confronto host case-insensitive', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ origin: 'https://FANTACER.TEST', [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: true })
  })

  it('porta esplicita nel Host header combacia con Origin', () => {
    const csrf = generateCsrfToken()
    const result = verifyCsrfForRequest(
      request({ host: 'localhost:3000', origin: 'http://localhost:3000', [CSRF_HEADER]: csrf }),
      keyring,
      sessionFor(csrf),
    )
    expect(result).toEqual({ ok: true })
  })

  it('fallback a nextUrl.origin quando il Host header manca', () => {
    const csrf = generateCsrfToken()
    const noHost: FakeRequest = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'origin' ? ORIGIN : name.toLowerCase() === CSRF_HEADER ? csrf : null,
      },
      nextUrl: { origin: ORIGIN },
    }
    expect(verifyCsrfForRequest(noHost, keyring, sessionFor(csrf))).toEqual({ ok: true })

    const noHostNoNextUrl: FakeRequest = {
      headers: noHost.headers,
    }
    expect(verifyCsrfForRequest(noHostNoNextUrl, keyring, sessionFor(csrf))).toEqual({
      ok: false,
      reason: 'origin',
    })
  })
})
