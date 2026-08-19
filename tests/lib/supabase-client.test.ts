import { safeStorage, safeCookieMethods } from '@/lib/supabase/client'

/**
 * Regressione: su browser mobile con storage bloccato (Safari private browsing,
 * "Prevent Cross-Site Tracking", in-app browser) l'accesso a `localStorage` /
 * `document.cookie` lancia `SecurityError: The operation is insecure.`.
 * `@supabase/auth-js` `_emitInitialSession` non gestisce l'eccezione → rejection
 * non gestita → `onUncaughtError` di React 19 → boundary globale → pagina
 * "500 Internal Server Error" fantasma (client-side, con HTTP 200 dal server).
 */

describe('safeStorage', () => {
  const realGetItem = Storage.prototype.getItem
  const realSetItem = Storage.prototype.setItem
  const realRemoveItem = Storage.prototype.removeItem

  afterEach(() => {
    Storage.prototype.getItem = realGetItem
    Storage.prototype.setItem = realSetItem
    Storage.prototype.removeItem = realRemoveItem
    localStorage.clear()
  })

  function blockStorage() {
    Storage.prototype.getItem = function () {
      throw new Error('The operation is insecure.')
    }
    Storage.prototype.setItem = function () {
      throw new Error('The operation is insecure.')
    }
    Storage.prototype.removeItem = function () {
      throw new Error('The operation is insecure.')
    }
  }

  it('returns null from getItem when localStorage.getItem throws (mobile blocked storage)', () => {
    blockStorage()
    expect(() => safeStorage.getItem('sb-test-auth-token')).not.toThrow()
    expect(safeStorage.getItem('sb-test-auth-token')).toBeNull()
  })

  it('does not throw on setItem when localStorage.setItem throws', () => {
    blockStorage()
    expect(() => safeStorage.setItem('sb-test-auth-token', 'value')).not.toThrow()
  })

  it('does not throw on removeItem when localStorage.removeItem throws', () => {
    blockStorage()
    expect(() => safeStorage.removeItem('sb-test-auth-token')).not.toThrow()
  })

  it('reads, writes and removes through localStorage when available', () => {
    safeStorage.setItem('sb-test-auth-token', 'value')
    expect(safeStorage.getItem('sb-test-auth-token')).toBe('value')
    safeStorage.removeItem('sb-test-auth-token')
    expect(safeStorage.getItem('sb-test-auth-token')).toBeNull()
  })

  // Nota: il ramo SSR (`typeof window === 'undefined'`) non è testabile in
  // jsdom: `globalThis.window` è un getter non-configurable, quindi né
  // `jest.replaceProperty` né `jest.spyOn(..., 'get')` possono rimuoverlo.
  // Il guard è una riga difensiva; la regressione coperta è lo storage bloccato.
})

describe('safeCookieMethods', () => {
  // `document.cookie` vive su Document.prototype: per ripristinarlo basta
  // rimuovere l'own property definita dal test (delete → torna il prototipo).
  afterEach(() => {
    delete (document as unknown as { cookie?: string }).cookie
  })

  it('returns [] from getAll when document.cookie access throws (blocked site data)', () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        throw new Error('The operation is insecure.')
      },
      set() {
        throw new Error('The operation is insecure.')
      },
    })
    expect(() => safeCookieMethods.getAll?.()).not.toThrow()
    expect(safeCookieMethods.getAll?.()).toEqual([])
  })

  it('does not throw on setAll when document.cookie write throws', () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        throw new Error('The operation is insecure.')
      },
      set() {
        throw new Error('The operation is insecure.')
      },
    })
    expect(() =>
      safeCookieMethods.setAll?.([{ name: 'sb-test-auth-token', value: 'value', options: {} }], {})
    ).not.toThrow()
  })

  it('reads and writes cookies through document.cookie when available', () => {
    safeCookieMethods.setAll?.(
      [{ name: 'sb-test-auth-token', value: 'value', options: { path: '/' } }],
      {}
    )
    const cookies = safeCookieMethods.getAll?.() ?? []
    expect(cookies).toContainEqual({ name: 'sb-test-auth-token', value: 'value' })
  })
})