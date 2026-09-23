/**
 * @jest-environment node
 */
import { canonicalizeIp, resolveIpSignal, getTrustedClientIp, hmacIp } from '@/lib/request-ip'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('canonicalizeIp', () => {
  it('IPv4', () => {
    expect(canonicalizeIp('192.168.1.10')).toBe('192.168.1.10')
    expect(canonicalizeIp(' 203.0.113.7 ')).toBe('203.0.113.7')
    expect(canonicalizeIp('1.2.3.4:5678')).toBe('1.2.3.4')
  })

  it('IPv6 canonicalizzato (non solo validato)', () => {
    expect(canonicalizeIp('2001:0DB8::0001')).toBe('2001:db8::1')
    expect(canonicalizeIp('2001:db8:0:0:0:0:0:1')).toBe('2001:db8::1')
    expect(canonicalizeIp('::1')).toBe('::1')
    expect(canonicalizeIp('::')).toBe('::')
    expect(canonicalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1')
    expect(canonicalizeIp('fe80::1%eth0')).toBe('fe80::1')
  })

  it('IPv4-mapped converge all IPv4', () => {
    expect(canonicalizeIp('::ffff:192.168.1.10')).toBe('192.168.1.10')
    expect(canonicalizeIp('::ffff:c0a8:010a')).toBe('192.168.1.10')
    expect(canonicalizeIp('::FFFF:C0A8:010A')).toBe('192.168.1.10')
  })

  it('invalido → null', () => {
    const invalid = [
      undefined,
      null,
      '',
      '   ',
      'not-an-ip',
      '1.2.3.4.5',
      '999.1.1.1',
      '::gg',
      '1.2.3.4/24',
      'evil;drop table',
      '192.168.1.10:abc',
    ]
    for (const v of invalid) {
      expect(canonicalizeIp(v as string | null | undefined)).toBeNull()
    }
  })
})

describe('resolveIpSignal', () => {
  it('cf-connecting-ip + cf-ray → medium', () => {
    expect(resolveIpSignal({ cfConnectingIp: '203.0.113.7', cfRay: 'abc123-MXP' })).toEqual({
      ip: '203.0.113.7',
      source: 'cf-connecting-ip',
      confidence: 'medium',
    })
  })

  it('cf-connecting-ip forgiato senza cf-ray → ip null (anti-spoof)', () => {
    expect(resolveIpSignal({ cfConnectingIp: '203.0.113.7', nodeEnv: 'production' })).toEqual({
      ip: null,
      source: 'cf-connecting-ip',
      confidence: 'low',
    })
  })

  it('x-forwarded-for ignorato in produzione (header client-controllabile)', () => {
    expect(resolveIpSignal({ forwardedFor: '1.2.3.4, 10.0.0.1', nodeEnv: 'production' })).toEqual({
      ip: null,
      source: 'none',
      confidence: 'none',
    })
  })

  it('catena XFF in locale: solo primo valore, confidence low', () => {
    expect(
      resolveIpSignal({ forwardedFor: '198.51.100.9, 203.0.113.7', nodeEnv: 'development' }),
    ).toEqual({ ip: '198.51.100.9', source: 'x-forwarded-for', confidence: 'low' })
  })

  it('x-real-ip (Vercel) → low', () => {
    expect(resolveIpSignal({ realIp: '198.51.100.9', nodeEnv: 'production' })).toEqual({
      ip: '198.51.100.9',
      source: 'x-real-ip',
      confidence: 'low',
    })
  })

  it('header assenti → null, mai valore condiviso', () => {
    expect(resolveIpSignal({ nodeEnv: 'production' })).toEqual({
      ip: null,
      source: 'none',
      confidence: 'none',
    })
  })

  it('catena mista: cf-connecting-ip vince e cf-ray abilita medium', () => {
    expect(
      resolveIpSignal({
        cfConnectingIp: '203.0.113.7',
        cfRay: 'r',
        realIp: '10.0.0.1',
        forwardedFor: '1.2.3.4',
        nodeEnv: 'production',
      }),
    ).toEqual({ ip: '203.0.113.7', source: 'cf-connecting-ip', confidence: 'medium' })
  })
})

describe('getTrustedClientIp', () => {
  it('canonicalizza IPv6 e mapped dagli header', () => {
    const v6 = getTrustedClientIp(
      new Request('https://x/', {
        headers: { 'cf-connecting-ip': '2001:DB8::0:1', 'cf-ray': 'r' },
      }),
    )
    expect(v6).toEqual({ ip: '2001:db8::1', source: 'cf-connecting-ip', confidence: 'medium' })

    const mapped = getTrustedClientIp(
      new Request('https://x/', {
        headers: { 'cf-connecting-ip': '::ffff:192.168.1.10', 'cf-ray': 'r' },
      }),
    )
    expect(mapped.ip).toBe('192.168.1.10')
  })

  it('ignora header IP non validi', () => {
    const signal = getTrustedClientIp(
      new Request('https://x/', {
        headers: { 'cf-connecting-ip': 'evil;drop', 'cf-ray': 'r' },
      }),
    )
    expect(signal).toEqual({ ip: null, source: 'none', confidence: 'none' })
  })
})

describe('hmacIp', () => {
  it('nessuna chiave → null (fail-safe, mai IP grezzo)', () => {
    delete process.env.SIGNAL_HMAC_KEY
    expect(hmacIp('1.2.3.4')).toBeNull()
  })

  it('deterministico e versionato', () => {
    process.env.SIGNAL_HMAC_KEY = Buffer.from('secret').toString('base64')
    process.env.SIGNAL_HMAC_KEY_ID = 'k1'
    const a = hmacIp('1.2.3.4')
    expect(a).toMatch(/^k1\.[0-9a-f]{64}$/)
    expect(hmacIp('1.2.3.4')).toBe(a)
    expect(hmacIp('1.2.3.5')).not.toBe(a)
  })
})
