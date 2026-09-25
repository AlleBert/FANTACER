/**
 * @jest-environment node
 */
import { createHmac } from 'node:crypto'
import {
  parseKeyring,
  keyringFromEnv,
  generateToken,
  hashToken,
  formatSessionCookie,
  parseSessionCookie,
  verifyToken,
  sessionCookieOptions,
  generateCsrfToken,
  hashCsrfToken,
  verifyCsrf,
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  SESSION_IDLE_MS,
  SESSION_ABSOLUTE_MS,
} from '@/lib/session-identity'

const ORIGINAL_ENV = { ...process.env }
const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64')

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('parseKeyring', () => {
  it('null senza env o active', () => {
    expect(parseKeyring(undefined, 'k1')).toBeNull()
    expect(parseKeyring('k1:' + b64(32), undefined)).toBeNull()
  })
  it('accetta chiavi ≥32 byte', () => {
    const kr = parseKeyring(`k1:${b64(32)},k2:${b64(40)}`, 'k2')
    expect(kr).not.toBeNull()
    expect(kr!.active).toBe('k2')
    expect(kr!.keys.size).toBe(2)
  })
  it('scarta chiavi <32 byte e active assente', () => {
    expect(parseKeyring(`k1:${b64(16)}`, 'k1')).toBeNull()
    expect(parseKeyring(`k1:${b64(32)}`, 'k9')).toBeNull()
  })
})

describe('token', () => {
  it('generateToken è casuale e non vuoto', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(30)
  })
  it('hashToken deterministico e null per key sconosciuta', () => {
    const kr = parseKeyring(`k1:${b64(32)}`, 'k1')!
    const h = hashToken('k1', 'tok', kr)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('k1', 'tok', kr)).toBe(h)
    expect(hashToken('nope', 'tok', kr)).toBeNull()
  })
})

describe('cookie', () => {
  it('roundtrip key_id.token', () => {
    const value = formatSessionCookie('k1', 'abc')
    expect(value).toBe('k1.abc')
    expect(parseSessionCookie(value)).toEqual({ keyId: 'k1', token: 'abc' })
  })
  it('valori invalidi → null', () => {
    for (const v of [null, undefined, '', 'nodot', '.tok', 'k1.', 'k1.']) {
      expect(parseSessionCookie(v as string | null | undefined)).toBeNull()
    }
  })
  it('opzioni sicure', () => {
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.secure).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(SESSION_COOKIE_MAX_AGE)
    expect(SESSION_COOKIE).toBe('fantacer_session')
  })
})

describe('verifyToken', () => {
  const kr = parseKeyring(`k1:${b64(32)}`, 'k1')!
  it('true per token corretto', () => {
    const token = generateToken()
    const h = hashToken('k1', token, kr)!
    expect(verifyToken('k1', token, h, kr)).toBe(true)
  })
  it('false per token errato o hash errato', () => {
    const token = generateToken()
    const h = hashToken('k1', token, kr)!
    expect(verifyToken('k1', token + 'x', h, kr)).toBe(false)
    expect(verifyToken('k1', token, 'deadbeef', kr)).toBe(false)
  })
})

describe('keyringFromEnv', () => {
  it('legge SESSION_HMAC_KEYS/ACTIVE', () => {
    process.env.SESSION_HMAC_KEYS = `k1:${b64(32)}`
    process.env.SESSION_HMAC_ACTIVE = 'k1'
    expect(keyringFromEnv()?.active).toBe('k1')
  })
})

describe('scadenze sessione', () => {
  it('idle < assoluta e coerenti col max-age cookie', () => {
    expect(SESSION_IDLE_MS).toBeGreaterThan(0)
    expect(SESSION_ABSOLUTE_MS).toBeGreaterThan(SESSION_IDLE_MS)
    expect(SESSION_ABSOLUTE_MS).toBe(SESSION_COOKIE_MAX_AGE * 1000)
  })
})

describe('CSRF', () => {
  const kr = parseKeyring(`k1:${b64(32)}`, 'k1')!

  it('generateCsrfToken è casuale e non vuoto', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(30)
  })

  it('hashCsrfToken deterministico, hex e diverso dal token in chiaro', () => {
    const csrf = generateCsrfToken()
    const h = hashCsrfToken(csrf, kr)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashCsrfToken(csrf, kr)).toBe(h)
    expect(h).not.toContain(csrf)
  })

  it('hashCsrfToken null se la key attiva manca dal keyring', () => {
    expect(hashCsrfToken('x', { active: 'k9', keys: new Map() })).toBeNull()
  })

  it('hashCsrfToken usa keyId esplicito (default = active)', () => {
    const kr2 = parseKeyring(`k1:${b64(32)},k2:${b64(40)}`, 'k1')!
    const csrf = generateCsrfToken()
    expect(hashCsrfToken(csrf, kr2)).toBe(hashCsrfToken(csrf, kr2, 'k1'))
    expect(hashCsrfToken(csrf, kr2, 'k1')).not.toBe(hashCsrfToken(csrf, kr2, 'k2'))
    expect(hashCsrfToken(csrf, kr2, 'nope')).toBeNull()
  })

  it('hashCsrfToken applica il namespace csrf.v1', () => {
    const key = Buffer.alloc(32, 7)
    const kr1 = parseKeyring(`k1:${key.toString('base64')}`, 'k1')!
    const csrf = generateCsrfToken()
    const expected = createHmac('sha256', key).update(`csrf.v1|${csrf}`).digest('hex')
    expect(hashCsrfToken(csrf, kr1)).toBe(expected)
  })

  it('verifyCsrf true solo per il token corretto', () => {
    const csrf = generateCsrfToken()
    const h = hashCsrfToken(csrf, kr)!
    expect(verifyCsrf(csrf, h, kr)).toBe(true)
    expect(verifyCsrf(csrf + 'x', h, kr)).toBe(false)
    expect(verifyCsrf(generateCsrfToken(), h, kr)).toBe(false)
    expect(verifyCsrf(csrf, 'deadbeef', kr)).toBe(false)
  })

  it('verifyCsrf false su valori mancanti (fail-closed)', () => {
    expect(verifyCsrf(null, 'abcd', kr)).toBe(false)
    expect(verifyCsrf(undefined, 'abcd', kr)).toBe(false)
    expect(verifyCsrf('csrf', null, kr)).toBe(false)
    expect(verifyCsrf('csrf', undefined, kr)).toBe(false)
    expect(verifyCsrf('csrf', '', kr)).toBe(false)
  })

  it('verifyCsrf false se la key attiva manca dal keyring', () => {
    expect(verifyCsrf('csrf', 'abcd', { active: 'k9', keys: new Map() })).toBe(false)
  })

  it('verifyCsrf rispetta il keyId esplicito', () => {
    const kr2 = parseKeyring(`k1:${b64(32)},k2:${b64(40)}`, 'k1')!
    const csrf = generateCsrfToken()
    const h1 = hashCsrfToken(csrf, kr2, 'k1')!
    const h2 = hashCsrfToken(csrf, kr2, 'k2')!
    expect(verifyCsrf(csrf, h1, kr2, 'k1')).toBe(true)
    expect(verifyCsrf(csrf, h1, kr2, 'k2')).toBe(false)
    expect(verifyCsrf(csrf, h2, kr2, 'k2')).toBe(true)
  })
})
