/**
 * @jest-environment node
 */
import { getStoredVoterId, setStoredVoterId, clearStoredVoterId } from '@/lib/vote-persistence'

describe('vote-persistence (SSR / no window)', () => {
  it('getStoredVoterId ritorna null senza window', () => {
    expect(getStoredVoterId()).toBeNull()
  })

  it('set e clear non lanciano senza window', () => {
    expect(() => setStoredVoterId('x')).not.toThrow()
    expect(() => clearStoredVoterId()).not.toThrow()
  })
})
