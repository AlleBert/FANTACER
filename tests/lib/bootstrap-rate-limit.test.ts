/**
 * @jest-environment node
 */
import {
  evaluateBootstrapRateLimit,
  bootstrapRateLimitMode,
  bootstrapRateWindowMs,
  bootstrapRateIpMax,
  BOOTSTRAP_RATE_WINDOW_MS,
  BOOTSTRAP_RATE_IP_MAX,
} from '@/lib/bootstrap-rate-limit'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.restoreAllMocks()
})

it('observe (default): calcola ma non blocca', async () => {
  const check = jest.fn(async () => false)
  const d = await evaluateBootstrapRateLimit({ ipHash: 'k1.abc', check })
  expect(d.mode).toBe('observe')
  expect(d.rawAllowed).toBe(false)
  expect(d.allowed).toBe(true)
  expect(d.key).toBe('bootstrap:ip:k1.abc')
})

it('enforce: blocca quando l IP è oltre soglia', async () => {
  process.env.BOOTSTRAP_RATE_LIMIT_MODE = 'enforce'
  const check = jest.fn(async () => false)
  const d = await evaluateBootstrapRateLimit({ ipHash: 'k1.abc', check })
  expect(d.mode).toBe('enforce')
  expect(d.allowed).toBe(false)
  expect(d.rawAllowed).toBe(false)
  expect(d.retryAfterSec).toBe(Math.ceil(BOOTSTRAP_RATE_WINDOW_MS / 1000))
})

it('enforce: consente entro soglia', async () => {
  process.env.BOOTSTRAP_RATE_LIMIT_MODE = 'enforce'
  const check = jest.fn(async () => true)
  const d = await evaluateBootstrapRateLimit({ ipHash: 'k1.abc', check })
  expect(d.allowed).toBe(true)
  expect(d.rawAllowed).toBe(true)
})

it('ipHash null → nessuna chiamata, sempre allowed', async () => {
  process.env.BOOTSTRAP_RATE_LIMIT_MODE = 'enforce'
  const check = jest.fn(async () => false)
  const d = await evaluateBootstrapRateLimit({ ipHash: null, check })
  expect(check).not.toHaveBeenCalled()
  expect(d.allowed).toBe(true)
  expect(d.key).toBeNull()
})

it('chiave pseudonimizzata, mai IP grezzo', async () => {
  const check = jest.fn(async () => true)
  await evaluateBootstrapRateLimit({ ipHash: 'k1.deadbeef', check })
  const key = (check.mock.calls[0] as unknown as [string, number, number])[0]
  expect(key).toBe('bootstrap:ip:k1.deadbeef')
  expect(key).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
})

it('override env di finestra e soglia', () => {
  process.env.BOOTSTRAP_RATE_WINDOW_MS = '60000'
  process.env.BOOTSTRAP_RATE_IP_MAX = '3'
  expect(bootstrapRateWindowMs()).toBe(60000)
  expect(bootstrapRateIpMax()).toBe(3)
})

it('valori env non validi → fallback', () => {
  process.env.BOOTSTRAP_RATE_IP_MAX = '-1'
  process.env.BOOTSTRAP_RATE_WINDOW_MS = 'abc'
  expect(bootstrapRateIpMax()).toBe(BOOTSTRAP_RATE_IP_MAX)
  expect(bootstrapRateWindowMs()).toBe(BOOTSTRAP_RATE_WINDOW_MS)
})

it('mode ignoto → observe (fail-safe)', () => {
  process.env.BOOTSTRAP_RATE_LIMIT_MODE = 'banana'
  expect(bootstrapRateLimitMode()).toBe('observe')
})

it('warning would-block senza valori sensibili', async () => {
  const check = jest.fn(async () => false)
  await evaluateBootstrapRateLimit({ ipHash: 'k1.deadbeef', check })
  expect(console.warn).toHaveBeenCalledWith(
    '[bootstrap-rate] would-block',
    expect.objectContaining({ scope: 'ip' }),
  )
  const payload = (console.warn as jest.Mock).mock.calls[0][1]
  expect(JSON.stringify(payload)).not.toContain('deadbeef')
})
