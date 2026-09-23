/**
 * @jest-environment node
 */
import {
  evaluateVoteRateLimit,
  voteRateWindowMs,
  voteRateIpMax,
  voteRateIdMax,
  VOTE_RATE_WINDOW_MS,
} from '@/lib/vote-rate-limit'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.restoreAllMocks()
})

it('observe: calcola ma non blocca', async () => {
  const check = jest.fn(async () => false)
  const d = await evaluateVoteRateLimit({ ipHash: 'k1.abc', fingerprint: 'v1:x', check })
  expect(d.mode).toBe('observe')
  expect(d.rawAllowed).toBe(false)
  expect(d.allowed).toBe(true)
})

it('enforce: blocca quando un ambito è oltre soglia', async () => {
  process.env.VOTE_RATE_LIMIT_MODE = 'enforce'
  const check = jest.fn(async () => false)
  const d = await evaluateVoteRateLimit({ ipHash: 'k1.abc', fingerprint: 'v1:x', check })
  expect(d.mode).toBe('enforce')
  expect(d.allowed).toBe(false)
  expect(d.retryAfterSec).toBe(Math.ceil(VOTE_RATE_WINDOW_MS / 1000))
})

it('enforce: consente quando tutti gli ambiti sono entro soglia', async () => {
  process.env.VOTE_RATE_LIMIT_MODE = 'enforce'
  const check = jest.fn(async () => true)
  const d = await evaluateVoteRateLimit({ ipHash: 'k1.abc', fingerprint: 'v1:x', check })
  expect(d.allowed).toBe(true)
  expect(d.rawAllowed).toBe(true)
})

it('ipHash null → nessun ambito IP (solo identità)', async () => {
  const check = jest.fn(async () => true)
  const d = await evaluateVoteRateLimit({ ipHash: null, fingerprint: 'v1:x', check })
  expect(d.scopes.map((s) => s.scope)).toEqual(['id'])
  expect(check).toHaveBeenCalledTimes(1)
})

it('chiavi pseudonimizzate, mai IP grezzo', async () => {
  const check = jest.fn(async (_key: string, _windowMs: number, _max: number) => true)
  await evaluateVoteRateLimit({ ipHash: 'k1.deadbeef', fingerprint: 'v1:x', check })
  const keys = check.mock.calls.map((c) => c[0])
  expect(keys).toContain('vote:ip:k1.deadbeef')
  expect(keys).toContain('vote:id:v1:x')
  for (const k of keys) expect(k).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
})

it('override env di finestra e soglie', () => {
  process.env.VOTE_RATE_WINDOW_MS = '60000'
  process.env.VOTE_RATE_IP_MAX = '5'
  process.env.VOTE_RATE_ID_MAX = '2'
  expect(voteRateWindowMs()).toBe(60000)
  expect(voteRateIpMax()).toBe(5)
  expect(voteRateIdMax()).toBe(2)
})

it('valori env non validi → fallback', () => {
  process.env.VOTE_RATE_IP_MAX = '-1'
  process.env.VOTE_RATE_ID_MAX = 'abc'
  expect(voteRateIpMax()).toBeGreaterThan(0)
  expect(voteRateIdMax()).toBeGreaterThan(0)
})

it('emette warning would-block senza valori sensibili', async () => {
  const check = jest.fn(async () => false)
  await evaluateVoteRateLimit({ ipHash: 'k1.deadbeef', fingerprint: 'v1:x', check })
  expect(console.warn).toHaveBeenCalledWith(
    '[vote-rate] would-block',
    expect.objectContaining({ scopes: expect.any(Array) }),
  )
  const payload = (console.warn as jest.Mock).mock.calls[0][1]
  expect(JSON.stringify(payload)).not.toContain('deadbeef')
  expect(JSON.stringify(payload)).not.toContain('v1:x')
})
