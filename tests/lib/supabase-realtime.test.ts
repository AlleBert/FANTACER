import { safeSubscribe } from '@/lib/supabase/realtime'
import type { RealtimeChannel } from '@supabase/supabase-js'

describe('safeSubscribe', () => {
  function makeChannel(subscribe: () => void): RealtimeChannel {
    return { subscribe } as unknown as RealtimeChannel
  }

  it('delega a subscribe() e ritorna il canale', () => {
    const subscribe = jest.fn()
    const channel = makeChannel(subscribe)
    const callback = jest.fn()

    const result = safeSubscribe(channel, callback)

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith(callback)
    expect(result).toBe(channel)
  })

  it('invoca subscribe() senza callback quando omessa', () => {
    const subscribe = jest.fn()
    const channel = makeChannel(subscribe)

    safeSubscribe(channel)

    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith(undefined)
  })

  it('non propaga lancia se subscribe() lancia (storage bloccati su WebKit)', () => {
    const subscribe = jest.fn(() => {
      throw new Error('The operation is insecure.')
    })
    const channel = makeChannel(subscribe)

    expect(() => safeSubscribe(channel)).not.toThrow()
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('ritorna comunque il canale anche quando subscribe() lancia', () => {
    const subscribe = jest.fn(() => {
      throw new Error('The operation is insecure.')
    })
    const channel = makeChannel(subscribe)

    expect(safeSubscribe(channel)).toBe(channel)
  })
})