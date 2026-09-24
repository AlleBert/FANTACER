/**
 * @jest-environment node
 */
import { createHmac } from 'node:crypto'
import {
  RISK_SIGNALS_VERSION,
  SignalsConfigError,
  buildVoteRiskSignals,
  bucketizeBotd,
  signalsFingerprint,
  type VoteRiskSignals,
} from '@/lib/vote-risk-signals'
import { hmacIp, type ClientIpSignal } from '@/lib/request-ip'

const ORIGINAL_ENV = { ...process.env }

const KEY_B64 = Buffer.alloc(32, 7).toString('base64')
const KEY_ID = 'k1'

function setKey() {
  process.env.SIGNAL_HMAC_KEY = KEY_B64
  process.env.SIGNAL_HMAC_KEY_ID = KEY_ID
}

function clearKey() {
  delete process.env.SIGNAL_HMAC_KEY
  delete process.env.SIGNAL_HMAC_KEY_ID
}

const TRUSTED_IP: ClientIpSignal = {
  ip: '203.0.113.7',
  detectedIp: '203.0.113.7',
  source: 'cf-connecting-ip',
  confidence: 'medium',
}

const UNTRUSTED_IP: ClientIpSignal = {
  ip: null,
  detectedIp: '203.0.113.7',
  source: 'cf-connecting-ip',
  confidence: 'low',
}

const BASE_INPUT = {
  ipSignal: TRUSTED_IP,
  userAgent: 'Mozilla/5.0 (Test)',
  asn: 'AS12345',
  country: 'it',
  botd: '{"bot":false}',
  legacyFpPresent: false,
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  setKey()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('buildVoteRiskSignals — pseudonimizzazione HMAC', () => {
  it('include la versione e i campi tipizzati', () => {
    const signals = buildVoteRiskSignals(BASE_INPUT)
    expect(signals.version).toBe(RISK_SIGNALS_VERSION)
    expect(signals.ipConfidence).toBe('medium')
    expect(signals.country).toBe('IT')
    expect(signals.legacyFpPresent).toBe(false)
    expect(signals.botdBucket).toBe(0)
    expect(typeof signals.createdAtMs).toBe('number')
  })

  it('stesso input → stesso hash; input diverso → hash diverso', () => {
    const a = buildVoteRiskSignals(BASE_INPUT)
    const b = buildVoteRiskSignals(BASE_INPUT)
    expect(a.uaHash).toBe(b.uaHash)
    expect(a.asnHash).toBe(b.asnHash)
    expect(a.ipHmac).toBe(b.ipHmac)

    const other = buildVoteRiskSignals({
      ...BASE_INPUT,
      userAgent: 'Altro UA',
      asn: 'AS999',
      ipSignal: { ...TRUSTED_IP, ip: '198.51.100.9' },
    })
    expect(other.uaHash).not.toBe(a.uaHash)
    expect(other.asnHash).not.toBe(a.asnHash)
    expect(other.ipHmac).not.toBe(a.ipHmac)
  })

  it('ipHmac coincide con hmacIp del trusted IP (correlabile col percorso legacy)', () => {
    const signals = buildVoteRiskSignals(BASE_INPUT)
    expect(signals.ipHmac).toBe(hmacIp('203.0.113.7'))
    expect(signals.ipHmac).toMatch(/^k1\.[0-9a-f]{64}$/)
  })

  it('ASN e UA con lo stesso valore producono hash diversi (domain separation)', () => {
    const signals = buildVoteRiskSignals({ ...BASE_INPUT, userAgent: 'same', asn: 'same' })
    expect(signals.asnHash).not.toBe(signals.uaHash)
  })

  it('i valori grezzi non compaiono mai nel JSON dei segnali', () => {
    const rawIp = '203.0.113.7'
    const rawUa = 'Mozilla/5.0 (SuperSecretUA)'
    const rawAsn = 'AS65500'
    const rawBotd = '{"bot":true,"botKind":"super-secret-kind"}'

    const signals = buildVoteRiskSignals({
      ipSignal: { ...TRUSTED_IP, ip: rawIp, detectedIp: rawIp },
      userAgent: rawUa,
      asn: rawAsn,
      botd: rawBotd,
    })

    const json = JSON.stringify(signals)
    expect(json).not.toContain(rawIp)
    expect(json).not.toContain(rawUa)
    expect(json).not.toContain(rawAsn)
    expect(json).not.toContain('super-secret-kind')
  })

  it('IP non attendibile → ipHmac null ma confidence propagata', () => {
    const signals = buildVoteRiskSignals({ ...BASE_INPUT, ipSignal: UNTRUSTED_IP })
    expect(signals.ipHmac).toBeNull()
    expect(signals.ipConfidence).toBe('low')
  })

  it('nessun IP osservato → confidence none', () => {
    const signals = buildVoteRiskSignals({
      ...BASE_INPUT,
      ipSignal: { ip: null, detectedIp: null, source: 'none', confidence: 'none' },
    })
    expect(signals.ipHmac).toBeNull()
    expect(signals.ipConfidence).toBe('none')
  })

  it('chiave assente → campi HMAC null, nessun throw', () => {
    clearKey()
    const signals = buildVoteRiskSignals(BASE_INPUT)
    expect(signals.ipHmac).toBeNull()
    expect(signals.uaHash).toBeNull()
    expect(signals.asnHash).toBeNull()
    expect(signals.version).toBe(RISK_SIGNALS_VERSION)
  })

  it('campi opzionali assenti/vuoti → null, legacyFpPresent default false', () => {
    const signals = buildVoteRiskSignals({ ipSignal: UNTRUSTED_IP })
    expect(signals.uaHash).toBeNull()
    expect(signals.asnHash).toBeNull()
    expect(signals.country).toBeNull()
    expect(signals.legacyFpPresent).toBe(false)
    expect(signals.botdBucket).toBe(0)
  })

  it('sanitizza il country: 2 lettere uppercase, altrimenti null', () => {
    for (const value of ['it', ' IT ', 'de']) {
      expect(buildVoteRiskSignals({ ...BASE_INPUT, country: value }).country).toMatch(/^[A-Z]{2}$/)
    }
    for (const value of ['Italy', 'I1', 'I', 'ITA', '', null, undefined, '1T']) {
      expect(buildVoteRiskSignals({ ...BASE_INPUT, country: value }).country).toBeNull()
    }
  })

  it('legacyFpPresent=true viene preservato', () => {
    const signals = buildVoteRiskSignals({ ...BASE_INPUT, legacyFpPresent: true })
    expect(signals.legacyFpPresent).toBe(true)
  })
})

describe('bucketizeBotd', () => {
  it('input assente/vuoto → 0', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(bucketizeBotd(v)).toBe(0)
    }
  })

  it('bot true/false → 3/0', () => {
    expect(bucketizeBotd('{"bot":true}')).toBe(3)
    expect(bucketizeBotd('{"bot":false}')).toBe(0)
    expect(bucketizeBotd('true')).toBe(3)
    expect(bucketizeBotd('false')).toBe(0)
  })

  it('score in [0,1] bucketizzato', () => {
    expect(bucketizeBotd('{"score":0.1}')).toBe(0)
    expect(bucketizeBotd('{"score":0.3}')).toBe(1)
    expect(bucketizeBotd('{"score":0.6}')).toBe(2)
    expect(bucketizeBotd('{"score":0.9}')).toBe(3)
    expect(bucketizeBotd('0.8')).toBe(3)
  })

  it('score in scala 0..100 bucketizzato', () => {
    expect(bucketizeBotd('{"score":10}')).toBe(0)
    expect(bucketizeBotd('{"score":30}')).toBe(1)
    expect(bucketizeBotd('{"score":60}')).toBe(2)
    expect(bucketizeBotd('{"score":90}')).toBe(3)
  })

  it('bot true prevale su score basso', () => {
    expect(bucketizeBotd('{"bot":true,"score":0}')).toBe(3)
  })

  it('botKind senza score → 2', () => {
    expect(bucketizeBotd('{"botKind":"headless_chrome"}')).toBe(2)
  })

  it('malformato/sconosciuto → 0 e mai throw', () => {
    const cases = [
      'not-json',
      '{',
      '[]',
      '"string"',
      '{"score":"bad"}',
      '{"score":null}',
      '{"score":-1}',
      '123abc',
      '{"bot":"yes"}',
      '{"botKind":""}',
      '{"score":0}',
    ]
    for (const v of cases) {
      expect(() => bucketizeBotd(v)).not.toThrow()
      expect(bucketizeBotd(v)).toBe(0)
    }
    // Tipi inattesi non-stringa (difesa runtime) → 0, mai throw.
    expect(bucketizeBotd(42 as unknown as string)).toBe(0)
    expect(bucketizeBotd({ bot: true } as unknown as string)).toBe(0)
  })
})

describe('signalsFingerprint', () => {
  function sample(overrides: Partial<VoteRiskSignals> = {}): VoteRiskSignals {
    return {
      version: RISK_SIGNALS_VERSION,
      ipHmac: 'k1.aaaa',
      asnHash: 'k1.bbbb',
      uaHash: 'k1.cccc',
      ipConfidence: 'medium',
      country: 'IT',
      botdBucket: 1,
      legacyFpPresent: false,
      createdAtMs: 1_700_000_000_000,
      ...overrides,
    }
  }

  it('deterministico e versionato', () => {
    const a = signalsFingerprint(sample())
    const b = signalsFingerprint(sample())
    expect(a).toBe(b)
    expect(a).toMatch(/^k1\.[0-9a-f]{64}$/)
  })

  it('cambia al variare di ciascun campo stabile', () => {
    const base = signalsFingerprint(sample())
    expect(signalsFingerprint(sample({ ipHmac: 'k1.zzzz' }))).not.toBe(base)
    expect(signalsFingerprint(sample({ asnHash: null }))).not.toBe(base)
    expect(signalsFingerprint(sample({ uaHash: 'k1.yyyy' }))).not.toBe(base)
    expect(signalsFingerprint(sample({ botdBucket: 3 }))).not.toBe(base)
  })

  it('ignora i campi non stabili (country/legacyFpPresent/createdAtMs)', () => {
    const base = signalsFingerprint(sample())
    expect(
      signalsFingerprint(
        sample({ country: 'DE', legacyFpPresent: true, createdAtMs: 0, ipConfidence: 'low' }),
      ),
    ).toBe(base)
  })

  it('chiave assente → SignalsConfigError (fail-closed)', () => {
    clearKey()
    expect(() => signalsFingerprint(sample())).toThrow(SignalsConfigError)
  })

  it('chiave troppo corta → SignalsConfigError', () => {
    process.env.SIGNAL_HMAC_KEY = Buffer.alloc(16, 1).toString('base64')
    process.env.SIGNAL_HMAC_KEY_ID = KEY_ID
    expect(() => signalsFingerprint(sample())).toThrow(SignalsConfigError)
  })

  it('key id assente → SignalsConfigError', () => {
    process.env.SIGNAL_HMAC_KEY = KEY_B64
    delete process.env.SIGNAL_HMAC_KEY_ID
    expect(() => signalsFingerprint(sample())).toThrow(SignalsConfigError)
  })

  it('usare una chiave diversa produce fingerprint diverso', () => {
    const a = signalsFingerprint(sample())
    process.env.SIGNAL_HMAC_KEY = Buffer.alloc(32, 9).toString('base64')
    const b = signalsFingerprint(sample())
    expect(a).not.toBe(b)
  })
})

// Verifica esplicita che l'HMAC non dipenda da dettagli implementativi esterni.
describe('stabilità cross-check', () => {
  it('hmacField è HMAC-SHA256 del namespace+valore', () => {
    const expected = createHmac('sha256', Buffer.from(KEY_B64, 'base64'))
      .update('ua.v1|some-ua')
      .digest('hex')
    const signals = buildVoteRiskSignals({
      ipSignal: UNTRUSTED_IP,
      userAgent: 'some-ua',
    })
    expect(signals.uaHash).toBe(`${KEY_ID}.${expected}`)
  })
})
