/**
 * @jest-environment node
 */
import {
  serializeVoteRequestEnd,
  logVoteRequestEnd,
  VOTE_REQUEST_END_MARKER,
  type VoteOutcome,
} from '@/lib/vote-telemetry'

const EVENT = {
  outcome: 'success' as const,
  status: 200,
  ms: 42,
  rateMode: 'observe' as const,
  rateWouldBlock: false,
  rateIpWouldBlock: false,
  rateIdWouldBlock: false,
  rateScopes: { ip: true, id: true },
  ipSource: 'cf-connecting-ip',
  ipConfidence: 'medium',
  ipHasDetected: true,
  turnstileReason: null,
}

describe('vote_request_end marker', () => {
  it('serializza un unico JSON con il marker a livello info', () => {
    const line = serializeVoteRequestEnd(EVENT)
    expect(line.split('\n')).toHaveLength(1)
    const parsed = JSON.parse(line)
    expect(parsed.marker).toBe(VOTE_REQUEST_END_MARKER)
    expect(parsed.level).toBe('info')
    expect(parsed.outcome).toBe('success')
    expect(parsed.status).toBe(200)
    expect(parsed.rateScopes).toEqual({ ip: true, id: true })
  })

  it('espone i campi espliciti rateIpWouldBlock / rateIdWouldBlock', () => {
    const parsed = JSON.parse(
      serializeVoteRequestEnd({ ...EVENT, rateWouldBlock: true, rateIpWouldBlock: true, rateIdWouldBlock: false }),
    )
    expect(parsed.rateIpWouldBlock).toBe(true)
    expect(parsed.rateIdWouldBlock).toBe(false)
  })

  it('non contiene IP, UUID, token o ballot', () => {
    const line = serializeVoteRequestEnd(EVENT)
    expect(line).not.toMatch(/\d{1,3}(\.\d{1,3}){3}/)
    expect(line).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(line).not.toContain('v1:')
    expect(line).not.toContain('token=')
    expect(line).not.toContain('turnstile_token')
  })

  it('campi opzionali assenti → null', () => {
    const parsed = JSON.parse(
      serializeVoteRequestEnd({ outcome: 'error', status: 500, ms: 1 }),
    )
    expect(parsed.rateMode).toBeNull()
    expect(parsed.rateScopes).toBeNull()
    expect(parsed.ipSource).toBeNull()
    expect(parsed.turnstileReason).toBeNull()
  })

  it('logVoteRequestEnd usa console.log con il marker', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    logVoteRequestEnd(EVENT)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0][0])).toContain(VOTE_REQUEST_END_MARKER)
    spy.mockRestore()
  })
})

describe('vote_request_end — esiti e attributi C08', () => {
  it('accetta gli esiti no_session / renew_required / quarantined', () => {
    const outcomes: VoteOutcome[] = ['no_session', 'renew_required', 'quarantined']
    for (const outcome of outcomes) {
      const parsed = JSON.parse(serializeVoteRequestEnd({ outcome, status: 503, ms: 1 }))
      expect(parsed.outcome).toBe(outcome)
    }
  })

  it('serializza identityMode e riskDecision senza PII', () => {
    const parsed = JSON.parse(
      serializeVoteRequestEnd({
        ...EVENT,
        outcome: 'quarantined',
        identityMode: 'session',
        riskDecision: 'quarantine',
      }),
    )
    expect(parsed.identityMode).toBe('session')
    expect(parsed.riskDecision).toBe('quarantine')
  })

  it('identityMode/riskDecision assenti → null', () => {
    const parsed = JSON.parse(serializeVoteRequestEnd({ outcome: 'success', status: 200, ms: 1 }))
    expect(parsed.identityMode).toBeNull()
    expect(parsed.riskDecision).toBeNull()
  })
})
