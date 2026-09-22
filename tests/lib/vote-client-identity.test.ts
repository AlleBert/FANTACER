/**
 * @jest-environment jsdom
 */
import { VOTER_COOKIE, isUuid } from '../../src/lib/vote-identity'
import {
  __resetVoterIdentityForTests,
  ensureVoterId,
  initializeVoterIdentity,
  isNewVoterIdentity,
} from '../../src/lib/vote-client-identity'

const UUID = '11111111-2222-4333-8444-555555555555'
const OTHER_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LEGACY_FP = 'b9e2ed7ea02c48153440fe332da039e8'

function setCookie(id: string) {
  document.cookie = `${VOTER_COOKIE}=${id}; Path=/`
}

function readCookie(): string | null {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${VOTER_COOKIE}=`))
  return entry ? decodeURIComponent(entry.slice(VOTER_COOKIE.length + 1)) : null
}

function clearAll() {
  document.cookie = `${VOTER_COOKIE}=; Max-Age=0; Path=/`
  localStorage.clear()
  delete (navigator as unknown as { locks?: unknown }).locks
  __resetVoterIdentityForTests()
}

beforeEach(clearAll)

describe('initializeVoterIdentity', () => {
  it('genera e persiste un UUID quando non esiste nulla', async () => {
    const result = await initializeVoterIdentity()
    expect(isUuid(result.voterId)).toBe(true)
    expect(result.isNew).toBe(true)
    expect(localStorage.getItem('fantacer_voter_id')).toBe(result.voterId)
    expect(readCookie()).toBe(result.voterId)
  })

  it('recupera dal cookie se il localStorage è assente', async () => {
    setCookie(UUID)
    const result = await initializeVoterIdentity()
    expect(result).toEqual({ voterId: UUID, isNew: false })
    expect(localStorage.getItem('fantacer_voter_id')).toBe(UUID)
  })

  it('recupera dal localStorage se il cookie è assente e lo riscrive', async () => {
    localStorage.setItem('fantacer_voter_id', UUID)
    const result = await initializeVoterIdentity()
    expect(result).toEqual({ voterId: UUID, isNew: false })
    expect(readCookie()).toBe(UUID)
  })

  it('il cookie ha precedenza sul localStorage e lo riallinea', async () => {
    setCookie(UUID)
    localStorage.setItem('fantacer_voter_id', OTHER_UUID)
    const result = await initializeVoterIdentity()
    expect(result).toEqual({ voterId: UUID, isNew: false })
    expect(localStorage.getItem('fantacer_voter_id')).toBe(UUID)
  })

  it('ignora il valore legacy FingerprintJS e ne genera uno nuovo', async () => {
    localStorage.setItem('fantacer_voter_id', LEGACY_FP)
    const result = await initializeVoterIdentity()
    expect(result.isNew).toBe(true)
    expect(result.voterId).not.toBe(LEGACY_FP)
    expect(isUuid(result.voterId)).toBe(true)
  })

  it('due inizializzazioni simultanee convergono sulla stessa identità (Web Locks)', async () => {
    let chain: Promise<unknown> = Promise.resolve()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_name: string, cb: () => unknown) => {
          const run = chain.then(() => cb())
          chain = run.then(
            () => undefined,
            () => undefined,
          )
          return run
        },
      },
    })

    const [a, b] = await Promise.all([initializeVoterIdentity(), initializeVoterIdentity()])

    expect(a.voterId).toBe(b.voterId)
    expect(a.isNew).toBe(true)
    expect(b.isNew).toBe(false)
    expect(localStorage.getItem('fantacer_voter_id')).toBe(a.voterId)
  })

  it('storage non disponibile: genera un id di sessione senza crash (modalità degradata)', async () => {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)

    try {
      const first = await initializeVoterIdentity()
      const second = await initializeVoterIdentity()
      expect(isUuid(first.voterId)).toBe(true)
      expect(isUuid(second.voterId)).toBe(true)
      expect(first.isNew).toBe(true)
      expect(second.isNew).toBe(true)
    } finally {
      delete (document as unknown as { cookie?: string }).cookie
    }
  })
})

describe('ensureVoterId', () => {
  it('memoizza: chiamate ripetute ritornano lo stesso UUID', async () => {
    const first = await ensureVoterId()
    const second = await ensureVoterId()
    expect(first).toBe(second)
    expect(isNewVoterIdentity()).toBe(true)
  })
})
