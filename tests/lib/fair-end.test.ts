import {
  DEFAULT_FAIR_END_CONFIG, isValidTime, parseFairEndConfig, resolveRevealAt, computeFairEndPhase,
} from '@/lib/fair-end'

it('parse: default su valore assente o invalido', () => {
  expect(parseFairEndConfig(null)).toEqual(DEFAULT_FAIR_END_CONFIG)
  expect(parseFairEndConfig('not-json')).toEqual(DEFAULT_FAIR_END_CONFIG)
})

it('parse: merge parziale con validazione orari', () => {
  const c = parseFairEndConfig('{"revealTime":"09:15","ceremony":{"1":"10:00","2":"xx"}}')
  expect(c.revealTime).toBe('09:15')
  expect(c.ceremony['1']).toBe('10:00')
  expect(c.ceremony['2']).toBe(DEFAULT_FAIR_END_CONFIG.ceremony['2'])
  expect(c.ceremony['3']).toBe(DEFAULT_FAIR_END_CONFIG.ceremony['3'])
})

it('isValidTime', () => {
  expect(isValidTime('12:30')).toBe(true)
  expect(isValidTime('24:00')).toBe(false)
  expect(isValidTime('9:5')).toBe(false)
  expect(isValidTime(123)).toBe(false)
})

it('resolveRevealAt: oggi/Roma alle HH:MM (CEST +2)', () => {
  const now = new Date('2026-09-25T08:00:00Z')
  expect(resolveRevealAt('12:30', now)).toBe('2026-09-25T10:30:00.000Z')
})

it('computeFairEndPhase', () => {
  const reveal = '2026-09-25T10:30:00.000Z'
  expect(computeFairEndPhase(false, reveal, new Date(reveal))).toBe('off')
  expect(computeFairEndPhase(true, null, new Date(reveal))).toBe('waiting')
  expect(computeFairEndPhase(true, reveal, new Date('2026-09-25T09:00:00Z'))).toBe('waiting')
  expect(computeFairEndPhase(true, reveal, new Date('2026-09-25T11:00:00Z'))).toBe('final')
})
