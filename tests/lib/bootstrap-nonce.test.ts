/**
 * @jest-environment node
 */
import {
  createBootstrapNonce,
  consumeBootstrapNonce,
  countOutstandingBootstrapNonces,
  bootstrapNonceMaxOutstanding,
  verifyBootstrapCData,
  newBootstrapNonce,
  BOOTSTRAP_NONCE_TTL_MS,
  BOOTSTRAP_CDATA_PREFIX,
  BOOTSTRAP_NONCE_MAX_OUTSTANDING,
} from '@/lib/bootstrap-nonce'

interface MockOpts {
  insertError?: unknown
  updateError?: unknown
  consumed?: boolean
  outstanding?: number | null
  countError?: unknown
}

function mockAdmin(opts: MockOpts = {}) {
  const insert = jest.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const deleteLt = jest.fn().mockResolvedValue({ error: null })
  const del = jest.fn(() => ({ lt: deleteLt }))

  // Catena di consumazione: update().eq().is().gt().select()
  const consumeSelect = jest.fn().mockResolvedValue({
    data: opts.consumed ? [{ nonce: 'n' }] : [],
    error: opts.updateError ?? null,
  })
  const gt = jest.fn(() => ({ select: consumeSelect }))
  const is = jest.fn(() => ({ gt }))
  const eq = jest.fn(() => ({ is }))
  const update = jest.fn(() => ({ eq }))

  // Catena di conteggio: select().eq().is().gt()
  const countGt = jest.fn().mockResolvedValue({
    count: opts.outstanding === null ? null : (opts.outstanding ?? 0),
    error: opts.countError ?? null,
  })
  const countIs = jest.fn(() => ({ gt: countGt }))
  const countEq = jest.fn(() => ({ is: countIs }))
  const select = jest.fn(() => ({ eq: countEq }))

  const from = jest.fn(() => ({ insert, delete: del, update, select }))
  return {
    from,
    insert,
    del,
    deleteLt,
    update,
    eq,
    is,
    gt,
    consumeSelect,
    select,
    countEq,
    countIs,
    countGt,
  }
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
  it('inserisce nonce con cData bootstrap:<nonce>, ip_hmac e scadenza ~120s', async () => {
    const admin = mockAdmin()
    const before = Date.now()
    const result = await createBootstrapNonce(asAdmin(admin), 'k1.hash')

    expect(result).not.toBeNull()
    expect(result!.cData).toBe(`${BOOTSTRAP_CDATA_PREFIX}${result!.nonce}`)
    expect(result!.nonce).toMatch(/^[A-Za-z0-9_-]{20,}$/)

    const inserted = admin.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.nonce).toBe(result!.nonce)
    expect(inserted.purpose).toBe('bootstrap')
    expect(inserted.ip_hmac).toBe('k1.hash')
    const exp = new Date(String(inserted.expires_at)).getTime()
    expect(exp - before).toBeGreaterThanOrEqual(BOOTSTRAP_NONCE_TTL_MS - 2000)
    expect(exp - before).toBeLessThanOrEqual(BOOTSTRAP_NONCE_TTL_MS + 2000)
  })

  it('senza ipHash salva ip_hmac null (retro-compatibile)', async () => {
    const admin = mockAdmin()
    await createBootstrapNonce(asAdmin(admin))
    const inserted = admin.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.ip_hmac).toBeNull()
  })

  it('null su errore DB (fail-closed)', async () => {
    const admin = mockAdmin({ insertError: { message: 'boom' } })
    expect(await createBootstrapNonce(asAdmin(admin), 'k1.hash')).toBeNull()
  })
})

describe('bootstrapNonceMaxOutstanding', () => {
  const ORIGINAL_ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('default 3', () => {
    delete process.env.BOOTSTRAP_NONCE_MAX_OUTSTANDING
    expect(bootstrapNonceMaxOutstanding()).toBe(BOOTSTRAP_NONCE_MAX_OUTSTANDING)
    expect(BOOTSTRAP_NONCE_MAX_OUTSTANDING).toBe(3)
  })

  it('override env valido, fallback su valori non validi', () => {
    process.env.BOOTSTRAP_NONCE_MAX_OUTSTANDING = '5'
    expect(bootstrapNonceMaxOutstanding()).toBe(5)
    process.env.BOOTSTRAP_NONCE_MAX_OUTSTANDING = '-1'
    expect(bootstrapNonceMaxOutstanding()).toBe(BOOTSTRAP_NONCE_MAX_OUTSTANDING)
  })
})

describe('countOutstandingBootstrapNonces', () => {
  it('conta solo non consumati e non scaduti per ip_hmac', async () => {
    const admin = mockAdmin({ outstanding: 2 })
    const count = await countOutstandingBootstrapNonces(asAdmin(admin), 'k1.hash')

    expect(count).toBe(2)
    expect(admin.select).toHaveBeenCalledWith('nonce', { count: 'exact', head: true })
    expect(admin.countEq).toHaveBeenCalledWith('ip_hmac', 'k1.hash')
    expect(admin.countIs).toHaveBeenCalledWith('consumed_at', null)
    expect(admin.countGt).toHaveBeenCalledWith('expires_at', expect.any(String))
  })

  it('count null senza errore → 0', async () => {
    const admin = mockAdmin({ outstanding: null })
    expect(await countOutstandingBootstrapNonces(asAdmin(admin), 'k1.hash')).toBe(0)
  })

  it('errore DB → null (fail-closed)', async () => {
    const admin = mockAdmin({ countError: { message: 'boom' } })
    expect(await countOutstandingBootstrapNonces(asAdmin(admin), 'k1.hash')).toBeNull()
  })
})

describe('consumeBootstrapNonce', () => {
  it('consumo atomico: filtra consumed_at null e expires_at > now', async () => {
    const admin = mockAdmin({ consumed: true })
    const result = await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')

    expect(result).toBe('consumed')
    expect(admin.update).toHaveBeenCalledWith({ consumed_at: expect.any(String) })
    expect(admin.eq).toHaveBeenCalledWith('nonce', 'nonce-abc')
    expect(admin.is).toHaveBeenCalledWith('consumed_at', null)
    expect(admin.gt).toHaveBeenCalledWith('expires_at', expect.any(String))
    expect(admin.consumeSelect).toHaveBeenCalledWith('nonce')
  })

  it('riuso (0 righe) → invalid', async () => {
    const admin = mockAdmin({ consumed: false })
    expect(await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')).toBe('invalid')
  })

  it('scaduto: il bound expires_at > now viene applicato e 0 righe → invalid', async () => {
    const admin = mockAdmin({ consumed: false })
    const before = Date.now()
    const result = await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')
    expect(result).toBe('invalid')
    const bound = (admin.gt.mock.calls[0] as unknown as [string, string])[1]
    expect(new Date(bound).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(bound).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('nonce vuoto → invalid senza query', async () => {
    const admin = mockAdmin()
    expect(await consumeBootstrapNonce(asAdmin(admin), '')).toBe('invalid')
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('errore DB → error (distinto da invalid)', async () => {
    const admin = mockAdmin({ consumed: true, updateError: { message: 'boom' } })
    expect(await consumeBootstrapNonce(asAdmin(admin), 'nonce-abc')).toBe('error')
  })

  it('concorrenza: due consume dello stesso nonce → un solo consumed', async () => {
    const admin = mockAdmin({ consumed: false })
    // Simula la re-check atomica: la prima UPDATE ritorna la riga, la seconda 0.
    admin.consumeSelect
      .mockResolvedValueOnce({ data: [{ nonce: 'n' }], error: null })
      .mockResolvedValue({ data: [], error: null })

    const [a, b] = await Promise.all([
      consumeBootstrapNonce(asAdmin(admin), 'nonce-abc'),
      consumeBootstrapNonce(asAdmin(admin), 'nonce-abc'),
    ])

    expect([a, b].sort()).toEqual(['consumed', 'invalid'])
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
