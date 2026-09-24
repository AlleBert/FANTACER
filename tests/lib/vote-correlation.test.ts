/**
 * @jest-environment node
 */
import {
  CORRELATION_VERSION,
  assessNewSessionRisk,
  type CorrelationSignals,
} from '@/lib/vote-correlation'

function signals(overrides: Partial<CorrelationSignals> = {}): CorrelationSignals {
  return {
    signalsFingerprint: 'fp-A',
    ipHmac: 'ip-1',
    asnHash: 'asn-1',
    uaHash: 'ua-1',
    legacyFingerprint: 'v1:legacy-1',
    ...overrides,
  }
}

describe('assessNewSessionRisk — correlazione nuova sessione (groundwork C08)', () => {
  it('nessun principal pregresso con voto same-day → accept', () => {
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [] }),
    ).toBe('accept')
  })

  it('nessuna sovrapposizione di segnali → accept', () => {
    const prior = signals({
      signalsFingerprint: 'fp-B',
      ipHmac: 'ip-2',
      asnHash: 'asn-2',
      uaHash: 'ua-2',
      legacyFingerprint: 'v1:legacy-2',
    })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('accept')
  })

  it('signalsFingerprint identico → quarantine (match forte)', () => {
    const prior = signals({ ipHmac: 'ip-9', uaHash: 'ua-9', asnHash: 'asn-9' })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('quarantine')
  })

  it('legacyFingerprint residuo identico → quarantine', () => {
    const prior = signals({
      signalsFingerprint: 'fp-B',
      ipHmac: 'ip-2',
      asnHash: 'asn-2',
      uaHash: 'ua-2',
    })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('quarantine')
  })

  it('due componenti condivise (ip+ua) → quarantine', () => {
    const prior = signals({
      signalsFingerprint: 'fp-B',
      asnHash: 'asn-2',
      legacyFingerprint: null,
    })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('quarantine')
  })

  it('una sola componente condivisa (ip) → stepup', () => {
    const prior = signals({
      signalsFingerprint: 'fp-B',
      asnHash: 'asn-2',
      uaHash: 'ua-2',
      legacyFingerprint: null,
    })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('stepup')
  })

  it('una sola componente condivisa (ua) → stepup', () => {
    const prior = signals({
      signalsFingerprint: 'fp-B',
      ipHmac: 'ip-2',
      asnHash: 'asn-2',
      legacyFingerprint: null,
    })
    expect(
      assessNewSessionRisk({ signals: signals(), priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('stepup')
  })

  it('componenti null non contano come sovrapposizione', () => {
    const current = signals({ ipHmac: null, asnHash: null, uaHash: null, legacyFingerprint: null })
    const prior = signals({ signalsFingerprint: 'fp-B', ipHmac: null, asnHash: null, uaHash: null, legacyFingerprint: null })
    expect(
      assessNewSessionRisk({ signals: current, priorPrincipalsWithSameDayVote: [prior] }),
    ).toBe('accept')
  })

  it('considera il massimo overlap su più principal pregressi', () => {
    const weak = signals({ signalsFingerprint: 'fp-W', ipHmac: 'ip-1', asnHash: 'asn-W', uaHash: 'ua-W', legacyFingerprint: null })
    const strong = signals({ signalsFingerprint: 'fp-S', asnHash: 'asn-S', uaHash: 'ua-1' })
    expect(
      assessNewSessionRisk({
        signals: signals(),
        priorPrincipalsWithSameDayVote: [weak, strong],
      }),
    ).toBe('quarantine')
  })

  it('usa il match massimo anche se un prior debole viene prima', () => {
    const weak = signals({ signalsFingerprint: 'fp-W', ipHmac: 'ip-1', asnHash: 'asn-W', uaHash: 'ua-W', legacyFingerprint: null })
    const exact = signals({ signalsFingerprint: 'fp-A' })
    expect(
      assessNewSessionRisk({
        signals: signals(),
        priorPrincipalsWithSameDayVote: [weak, exact],
      }),
    ).toBe('quarantine')
  })

  it('è deterministico e versiona il contratto', () => {
    expect(CORRELATION_VERSION).toBe(1)
    const input = { signals: signals(), priorPrincipalsWithSameDayVote: [signals()] }
    expect(assessNewSessionRisk(input)).toBe(assessNewSessionRisk(input))
  })
})
