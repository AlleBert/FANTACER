/**
 * @jest-environment node
 */
import {
  recordIpSignal,
  getIpSignalSnapshot,
  resetIpSignalMetrics,
} from '@/lib/ip-signal-metrics'

beforeEach(() => {
  resetIpSignalMetrics()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('conta assenza e per-confidence', () => {
  recordIpSignal({ ip: null, source: 'none', confidence: 'none' })
  recordIpSignal({ ip: '1.2.3.4', source: 'cf-connecting-ip', confidence: 'medium' })
  expect(getIpSignalSnapshot()).toEqual({
    total: 2,
    noTrustedIp: 1,
    byConfidence: { high: 0, medium: 1, low: 0, none: 1 },
  })
})

it('low conta come assenza di IP affidabile', () => {
  recordIpSignal({ ip: '1.2.3.4', source: 'x-real-ip', confidence: 'low' })
  expect(getIpSignalSnapshot().noTrustedIp).toBe(1)
})

it('non emette warning per segnali attendibili', () => {
  recordIpSignal({ ip: '1.2.3.4', source: 'cf-connecting-ip', confidence: 'medium' })
  expect(console.warn).not.toHaveBeenCalled()
})

it('emette warning strutturato senza valori IP', () => {
  recordIpSignal({ ip: null, source: 'none', confidence: 'none' })
  expect(console.warn).toHaveBeenCalledWith(
    '[ip] no trusted client ip',
    expect.objectContaining({ source: 'none', confidence: 'none' }),
  )
})
