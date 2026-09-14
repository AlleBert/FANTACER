import { getStoredVoterId, setStoredVoterId, clearStoredVoterId } from '@/lib/vote-persistence'

describe('vote-persistence', () => {
  const realGetItem = Storage.prototype.getItem
  const realSetItem = Storage.prototype.setItem
  const realRemoveItem = Storage.prototype.removeItem

  afterEach(() => {
    Storage.prototype.getItem = realGetItem
    Storage.prototype.setItem = realSetItem
    Storage.prototype.removeItem = realRemoveItem
    localStorage.clear()
  })

  it('salva e rilegge il visitorId', () => {
    setStoredVoterId('visitor-1')
    expect(getStoredVoterId()).toBe('visitor-1')
  })

  it('ritorna null quando assente', () => {
    expect(getStoredVoterId()).toBeNull()
  })

  it('clear rimuove il visitorId', () => {
    setStoredVoterId('visitor-1')
    clearStoredVoterId()
    expect(getStoredVoterId()).toBeNull()
  })

  it('non lancia quando lo storage è bloccato', () => {
    Storage.prototype.getItem = function () { throw new Error('The operation is insecure.') }
    Storage.prototype.setItem = function () { throw new Error('The operation is insecure.') }
    Storage.prototype.removeItem = function () { throw new Error('The operation is insecure.') }

    expect(() => setStoredVoterId('x')).not.toThrow()
    expect(getStoredVoterId()).toBeNull()
    expect(() => clearStoredVoterId()).not.toThrow()
  })
})
