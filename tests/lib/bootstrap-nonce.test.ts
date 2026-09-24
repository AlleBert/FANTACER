/**
 * @jest-environment node
 */
import {
  createBootstrapNonce,
  consumeBootstrapNonce,
  verifyBootstrapCData,
  newBootstrapNonce,
  BOOTSTRAP_NONCE_TTL_MS,
  BOOTSTRAP_CDATA_PREFIX,
} from '@/lib/bootstrap-nonce'

interface MockOpts {
  insertError?: unknown
  updateError?: unknown
  consumed?: boolean
}

function mockAdmin(opts: MockOpts = {}) {
  const insert = jest.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const deleteLt = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn(() => ({ lt: deleteLt }))
  const select = jest.fn().mockResolvedValue({
    data: opts.consumed ? [{ nonce: 'n' }] : [],
    error: opts.updateError ?? null,
  })
  const gt = jest.fn(() => ({ select }))
  const is = jest.fn(() => ({ gt }))
  const eq = jest.fn(() => ({ is }))
  const update = jest.fn(() => ({ eq }))
  const from = jest.fn(() => ({ insert, delete: del, update }))
  return { from, insert, del, deleteLt, update, eq, is, gt, select }
}

type Admin = Parameters<typeof createBootstrapNonce>[0]
const asAdmin = (m: ReturnType<typeof mockAdmin>) => m as unknown as Admin

describe('newBootstrapNonce', () => {
  it('genera nonce opachi, unici e base64url', () => {
    const a = newBootstrapNonce()
    const b = newBootstrapNonce()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,}$/)
  })
})

describe('createBootstrapNonce', () => {
  it('inserisce nonce con cData bootstrap:<nonce> e scadenza ~120s', async () => {
    const admin = mockAdmin()
    const before = Date.now()
    const result = await createBootstrapNonce(asAdmin(admin))

    expect(result).not.toBeNull()
    expect(result!.cData).toBe(`${BOOTSTRAP_CDATA_PREFIX}${result!.nonce}`)
    expect(result!.nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/)

    const inserted = admin.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.nonce).toBe(result!.nonce)
    expect(inserted.purpose).toBe('bootstrap')
    const exp = new Date(String(inserted.expires_at)).getTime()
    expect(exp - before).toBeGreaterThanOrEqual(BOOTSTRAP_NONCE_TTL_MS - 2000)
    expect(exp - before).toBeLessThanOrEqual(BOOTSTRAP_NONCE_TTL_MS + 2000)
  })

  it('null su errore DB (fail-closed)', async () => {
    const admin = mockAdmin({ insertError: { message: 'boom' } })
    expect(await createBootstrapNonce(asAdmin(admin))).toBeNull()
  })
})

describe('consumeBootstrapNonce', () => {
  it('consumo atomico: filtra consumed_at null e expires_at > now', async () => {
    const admin = mockAdmin({ consumed: true })
    const ok = await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')

    expect(ok).toBe(true)
    expect(admin.update).toHaveBeenCalledWith({ consumed_at: expect.any(String) })
    expect(admin.eq).toHaveBeenCalledWith('nonce', 'nonce-abc')
    expect(admin.is).toHaveBeenCalledWith('consumed_at', null)
    expect(admin.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
    expect(admin.select).toHaveBeenCalledWith('nonce')
  })

  it('nessuna riga (scaduto o già consumato) → false', async () => {
    const admin = mockAdmin({ consumed: false })
    expect(await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')).toBe(false)
  })

  it('nonce vuoto → false senza query', async () => {
    const admin = mockAdmin()
    expect(await consumeBootstrapNonce(asAdmin(admin), '')).toBe(false)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('errore DB → false (fail-closed, nessuna consumazione)', async () => {
    const admin = mockAdmin({ consumed: true, updateError: { message: 'boom' } })
    expect(await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')).toBe(false)
  })

  it('esegue cleanup per scadenza (best-effort)', async () => {
    const admin = mockAdmin({ consumed: true })
    await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')
    expect(admin.del).toHaveBeenCalled()
    expect(admin.deleteLt).toHaveBeenCalledWith('expires_at', expect.any(String))
  })
})

describe('verifyBootstrapCData', () => {
  it('estrare il nonce dal formato bootstrap:<nonce>', () => {
    expect(verifyBootstrapCData('bootstrap:abcDEF123_-xyzABCDEF')).toBe('abcDEF123_-xyzABCDEF')
  })

  it('null su formato errato', () => {
    expect(verifyBootstrapCData(undefined)).toBeNull()
    expect(verifyBootstrapCData(null)).toBeNull()
    expect(verifyBootstrapCData(123)).toBeNull()
    expect(verifyBootstrapCData('')).toBeNull()
    expect(verifyBootstrapCData('bootstrap:')).toBeNull()
    expect(verifyBootstrapCData('vote:abcDEF123_-xyzABCDEF')).toBeNull()
    expect(verifyBootstrapCData('bootstrap:short')).toBeNull()
    expect(verifyBootstrapCData('bootstrap:abc DEF123_-xyzABCDEF')).toBeNull()
  })
})
