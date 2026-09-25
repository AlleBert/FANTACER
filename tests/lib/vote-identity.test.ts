/**
 * @jest-environment node
 */
import { NextResponse } from 'next/server'
import {
  VOTER_COOKIE,
  VOTER_KEY_PREFIX,
  buildVoterKey,
  isUuid,
  parseVoterKey,
} from '../../src/lib/vote-identity'
import { applyVoterCookie, resolveVoterKey } from '../../src/lib/vote-identity-server'

const UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LEGACY_FP = 'b9e2ed7ea02c48153440fe332da039e8'

function request(cookie?: string) {
  return {
    cookies: {
      get: (name: string) => (cookie && name === VOTER_COOKIE ? { name, value: cookie } : undefined),
    },
  }
}

describe('vote-identity', () => {
  it('riconosce solo UUID canonici', () => {
    expect(isUuid(UUID)).toBe(true)
    expect(isUuid(UUID.toUpperCase())).toBe(true)
    expect(isUuid(LEGACY_FP)).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid('not-a-uuid')).toBe(false)
  })

  it('costruisce e interpreta la chiave versionata', () => {
    expect(buildVoterKey(UUID)).toBe(`${VOTER_KEY_PREFIX}${UUID}`)
    expect(buildVoterKey(UUID.toUpperCase())).toBe(`${VOTER_KEY_PREFIX}${UUID}`)
    expect(parseVoterKey(`${VOTER_KEY_PREFIX}${UUID}`)).toBe(UUID)
    expect(parseVoterKey(`v2:${UUID}`)).toBeNull()
    expect(parseVoterKey(LEGACY_FP)).toBeNull()
    expect(parseVoterKey(null)).toBeNull()
  })
})

describe('resolveVoterKey', () => {
  it('usa il cookie first-party quando è un UUID valido', () => {
    const resolved = resolveVoterKey(request(UUID))
    expect(resolved).toEqual({ key: `v1:${UUID}`, voterId: UUID })
  })

  it('senza cookie → null (nessun fallback al body)', () => {
    expect(resolveVoterKey(request())).toBeNull()
  })

  it('ignora un cookie legacy non-UUID → null', () => {
    expect(resolveVoterKey(request(LEGACY_FP))).toBeNull()
  })

  it('ignora eventuali argomenti body (C08: identità mai dal payload)', () => {
    // Difesa in profondità: anche se un chiamante passasse un UUID, non va
    // mai usato. Il cast evita che TypeScript blocchi la chiamata.
    const legacy = resolveVoterKey as unknown as (
      r: ReturnType<typeof request>,
      bodyVoterId?: unknown,
    ) => unknown
    expect(legacy(request(), UUID)).toBeNull()
    expect(legacy(request(LEGACY_FP), UUID)).toBeNull()
    expect(legacy(request(), OTHER_UUID)).toBeNull()
  })
})

describe('applyVoterCookie', () => {
  it('imposta il cookie identità', () => {
    const res = NextResponse.json({ ok: true })
    applyVoterCookie(res, UUID)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${VOTER_COOKIE}=${UUID}`)
    expect(setCookie).toContain('Max-Age=')
    expect(setCookie).toContain('SameSite=lax')
  })
})
