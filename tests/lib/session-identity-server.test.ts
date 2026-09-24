/**
 * @jest-environment node
 */
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/supabase/batch', () => ({ getActiveBatch: jest.fn() }))

import {
  sessionIdentityMode,
  createSession,
  resolveSession,
  resolveVoteIdentity,
  touchSession,
  renewSession,
  revokeSession,
  verifyCsrf,
} from '@/lib/session-identity-server'
import {
  parseKeyring,
  generateToken,
  hashToken,
  formatSessionCookie,
  generateCsrfToken,
  hashCsrfToken,
  SESSION_COOKIE,
  SESSION_ABSOLUTE_MS,
} from '@/lib/session-identity'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

const b64 = (n: number) => Buffer.alloc(n, 7).toString('base64')
const keyring = parseKeyring(`k1:${b64(32)}`, 'k1')!

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()

interface SessionRow {
  id: string
  principal_id: string
  csrf_hash: string | null
  expires_at: string
  last_seen_at: string
  revoked_at: string | null
}

function validRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'sess-1',
    principal_id: 'prim-1',
    csrf_hash: 'a'.repeat(64),
    expires_at: iso(SESSION_ABSOLUTE_MS),
    last_seen_at: iso(0),
    revoked_at: null,
    ...overrides,
  }
}

function mockAdmin(opts: {
  row?: SessionRow | null
  lookupError?: unknown
  insertError?: unknown
  updateError?: unknown
} = {}) {
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: opts.row ?? null, error: opts.lookupError ?? null })
  const selectEq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq: selectEq })
  const insert = jest.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const updateEq = jest.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })
  const from = jest.fn().mockReturnValue({ select, insert, update })
  return { from, select, selectEq, maybeSingle, insert, update, updateEq }
}

type Admin = Parameters<typeof resolveSession>[0]
const asAdmin = (m: ReturnType<typeof mockAdmin>) => m as unknown as Admin

describe('sessionIdentityMode', () => {
  it('default off', () => {
    delete process.env.SESSION_IDENTITY_MODE
    expect(sessionIdentityMode()).toBe('off')
  })

  it('accetta shadow/dual/session', () => {
    for (const m of ['shadow', 'dual', 'session'] as const) {
      process.env.SESSION_IDENTITY_MODE = m
      expect(sessionIdentityMode()).toBe(m)
    }
  })

  it('valori ignoti → off (fail-safe)', () => {
    process.env.SESSION_IDENTITY_MODE = 'banana'
    expect(sessionIdentityMode()).toBe('off')
  })
})

describe('createSession', () => {
  it('salva csrf_hash e ritorna il csrfToken in chiaro', async () => {
    const admin = mockAdmin()
    const result = await createSession(asAdmin(admin), 'ev-1', 'prim-1', keyring)

    expect(result).not.toBeNull()
    expect(result!.principalId).toBe('prim-1')
    expect(result!.csrfToken.length).toBeGreaterThan(30)

    const inserted = admin.insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.event_id).toBe('ev-1')
    expect(inserted.principal_id).toBe('prim-1')
    expect(inserted.key_id).toBe('k1')
    expect(inserted.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(inserted.csrf_hash).toBe(hashCsrfToken(result!.csrfToken, keyring))
    expect(inserted.csrf_hash).not.toBe(result!.csrfToken)
  })

  it('null se insert fallisce (fail-closed)', async () => {
    const admin = mockAdmin({ insertError: { message: 'boom' } })
    expect(await createSession(asAdmin(admin), 'ev-1', 'prim-1', keyring)).toBeNull()
  })
})

describe('resolveSession', () => {
  function cookieFor(token: string) {
    return formatSessionCookie('k1', token)
  }

  it('valida → principal, sessionId, csrfHash', async () => {
    const token = generateToken()
    const row = validRow()
    const admin = mockAdmin({ row })

    const result = await resolveSession(asAdmin(admin), cookieFor(token), keyring)

    expect(result).toEqual({
      principalId: 'prim-1',
      sessionId: 'sess-1',
      csrfHash: 'a'.repeat(64),
      expiresAt: row.expires_at,
      revokedAt: null,
    })
    expect(admin.selectEq).toHaveBeenCalledWith('token_hash', hashToken('k1', token, keyring))
  })

  it('cookie assente/malformato → null', async () => {
    expect(await resolveSession(asAdmin(mockAdmin()), null, keyring)).toBeNull()
    expect(await resolveSession(asAdmin(mockAdmin()), 'nodot', keyring)).toBeNull()
  })

  it('revocata → null', async () => {
    const admin = mockAdmin({ row: validRow({ revoked_at: iso(-1000) }) })
    const result = await resolveSession(
      asAdmin(admin),
      cookieFor(generateToken()),
      keyring,
    )
    expect(result).toBeNull()
  })

  it('idle scaduta → null', async () => {
    const row = validRow({ last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() })
    const result = await resolveSession(asAdmin(mockAdmin({ row })), cookieFor(generateToken()), keyring)
    expect(result).toBeNull()
  })

  it('assoluta scaduta → null', async () => {
    const row = validRow({ expires_at: new Date(Date.now() - 1000).toISOString() })
    const result = await resolveSession(asAdmin(mockAdmin({ row })), cookieFor(generateToken()), keyring)
    expect(result).toBeNull()
  })

  it('riga assente o errore DB → null (fail-closed)', async () => {
    expect(
      await resolveSession(asAdmin(mockAdmin({ row: null })), cookieFor(generateToken()), keyring),
    ).toBeNull()
    expect(
      await resolveSession(
        asAdmin(mockAdmin({ lookupError: { message: 'boom' } })),
        cookieFor(generateToken()),
        keyring,
      ),
    ).toBeNull()
  })

  it('accetta un now esplicito', async () => {
    const row = validRow({ last_seen_at: iso(0) })
    const future = Date.now() + 5 * 60 * 60 * 1000
    const result = await resolveSession(
      asAdmin(mockAdmin({ row })),
      cookieFor(generateToken()),
      keyring,
      future,
    )
    expect(result).toBeNull()
  })
})

describe('resolveVoteIdentity', () => {
  const cookieSource = (value?: string) => ({
    cookies: { get: (name: string) => (name === SESSION_COOKIE && value ? { value } : undefined) },
  })

  it('risolve la sessione dal cookie di sessione', async () => {
    const token = generateToken()
    const admin = mockAdmin({ row: validRow() })

    const result = await resolveVoteIdentity(
      asAdmin(admin),
      cookieSource(formatSessionCookie('k1', token)),
      keyring,
    )

    expect(result?.principalId).toBe('prim-1')
    expect(result?.sessionId).toBe('sess-1')
    // Nessuna scrittura: il rinnovo idle è del chiamante, dopo il CSRF.
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('cookie assente → null (fail-closed)', async () => {
    const admin = mockAdmin({ row: validRow() })
    expect(await resolveVoteIdentity(asAdmin(admin), cookieSource(), keyring)).toBeNull()
    expect(admin.select).not.toHaveBeenCalled()
  })
})

describe('touchSession', () => {
  it('aggiorna last_seen_at (best-effort)', async () => {
    const admin = mockAdmin()
    await touchSession(asAdmin(admin), 'sess-1')
    const patch = admin.update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof patch.last_seen_at).toBe('string')
    expect(admin.updateEq).toHaveBeenCalledWith('id', 'sess-1')
  })

  it('non lancia su errore DB', async () => {
    const admin = mockAdmin({ updateError: { message: 'boom' } })
    await expect(touchSession(asAdmin(admin), 'sess-1')).resolves.toBeUndefined()
  })
})

describe('renewSession', () => {
  it('ruota token_hash e csrf_hash, mantiene la scadenza assoluta', async () => {
    const oldToken = generateToken()
    const oldCookie = formatSessionCookie('k1', oldToken)
    const oldHash = hashToken('k1', oldToken, keyring)!
    const oldCsrf = generateCsrfToken()
    const row = validRow({ csrf_hash: hashCsrfToken(oldCsrf, keyring) })
    const admin = mockAdmin({ row })

    const renewed = await renewSession(asAdmin(admin), oldCookie, keyring)

    expect(renewed).not.toBeNull()
    expect(renewed!.cookieValue).not.toBe(oldCookie)
    expect(renewed!.csrfToken).not.toBe(oldCsrf)
    expect(renewed!.expiresAt).toBe(row.expires_at)

    const patch = admin.update.mock.calls[0][0] as Record<string, unknown>
    expect(patch.token_hash).not.toBe(oldHash)
    expect(patch.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(patch.csrf_hash).not.toBe(row.csrf_hash)
    expect(patch.csrf_hash).toBe(hashCsrfToken(renewed!.csrfToken, keyring))
    expect(patch.key_id).toBe('k1')
    expect(typeof patch.last_seen_at).toBe('string')
    // il renew NON tocca la scadenza assoluta (cap non estendibile)
    expect(patch).not.toHaveProperty('expires_at')
    // lookup per token_hash (l'id non è noto prima della lookup) e scrittura
    // scoped all'id della riga risolta
    expect(admin.selectEq).toHaveBeenCalledWith('token_hash', oldHash)
    expect(admin.updateEq).toHaveBeenCalledWith('id', 'sess-1')

    // il nuovo csrf non valida più il vecchio token
    expect(verifyCsrf(oldCsrf, patch.csrf_hash as string, keyring)).toBe(false)
  })

  it('null se idle scaduta, senza update', async () => {
    const row = validRow({
      last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    })
    const admin = mockAdmin({ row })
    expect(
      await renewSession(asAdmin(admin), formatSessionCookie('k1', generateToken()), keyring),
    ).toBeNull()
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('null se update fallisce (fail-closed)', async () => {
    const admin = mockAdmin({ row: validRow(), updateError: { message: 'boom' } })
    expect(
      await renewSession(asAdmin(admin), formatSessionCookie('k1', generateToken()), keyring),
    ).toBeNull()
  })

  it('null se la sessione è revocata', async () => {
    const admin = mockAdmin({ row: validRow({ revoked_at: iso(-1000) }) })
    expect(
      await renewSession(asAdmin(admin), formatSessionCookie('k1', generateToken()), keyring),
    ).toBeNull()
    expect(admin.update).not.toHaveBeenCalled()
  })

  it('null se assoluta scaduta', async () => {
    const admin = mockAdmin({ row: validRow({ expires_at: iso(-1000) }) })
    expect(
      await renewSession(asAdmin(admin), formatSessionCookie('k1', generateToken()), keyring),
    ).toBeNull()
  })

  it('null se cookie malformato o riga assente (fail-closed)', async () => {
    expect(await renewSession(asAdmin(mockAdmin()), 'nodot', keyring)).toBeNull()
    expect(
      await renewSession(asAdmin(mockAdmin({ row: null })), formatSessionCookie('k1', generateToken()), keyring),
    ).toBeNull()
  })
})

describe('revokeSession', () => {
  it('imposta revoked_at e revoke_reason', async () => {
    const admin = mockAdmin()
    const ok = await revokeSession(asAdmin(admin), 'sess-1', 'logout')

    expect(ok).toBe(true)
    const patch = admin.update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof patch.revoked_at).toBe('string')
    expect(patch.revoke_reason).toBe('logout')
    expect(admin.updateEq).toHaveBeenCalledWith('id', 'sess-1')
  })

  it('false su errore DB (fail-closed)', async () => {
    const admin = mockAdmin({ updateError: { message: 'boom' } })
    expect(await revokeSession(asAdmin(admin), 'sess-1', 'logout')).toBe(false)
  })
})

describe('verifyCsrf (re-export)', () => {
  it('true/false coerente con hashCsrfToken', () => {
    const csrf = generateCsrfToken()
    const h = hashCsrfToken(csrf, keyring)!
    expect(verifyCsrf(csrf, h, keyring)).toBe(true)
    expect(verifyCsrf(csrf, 'deadbeef', keyring)).toBe(false)
  })
})
