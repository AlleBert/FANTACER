import { getOrCreateDeviceId } from '@/lib/device'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('getOrCreateDeviceId', () => {
  const realGetItem = Storage.prototype.getItem
  const realSetItem = Storage.prototype.setItem

  afterEach(() => {
    Storage.prototype.getItem = realGetItem
    Storage.prototype.setItem = realSetItem
    localStorage.clear()
  })

  function blockStorage() {
    Storage.prototype.getItem = function () {
      throw new Error('The operation is insecure.')
    }
    Storage.prototype.setItem = function () {
      throw new Error('The operation is insecure.')
    }
  }

  it('returns a stable device id from localStorage', () => {
    localStorage.setItem('fantacer_device_id', 'aaaabbbb-cccc-4ddd-8eee-ffff00001111')
    expect(getOrCreateDeviceId()).toBe('aaaabbbb-cccc-4ddd-8eee-ffff00001111')
  })

  it('generates and persists a new device id when missing', () => {
    const id = getOrCreateDeviceId()
    expect(id).toMatch(UUID_RE)
    expect(localStorage.getItem('fantacer_device_id')).toBe(id)
  })

  it('generates a device id without throwing when storage is blocked', () => {
    blockStorage()
    expect(() => getOrCreateDeviceId()).not.toThrow()
    expect(getOrCreateDeviceId()).toMatch(UUID_RE)
  })
})