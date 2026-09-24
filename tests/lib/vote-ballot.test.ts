import {
  BALLOT_HASH_VERSION,
  ballotHash,
  canonicalBallotPayload,
  canonicalizeBallot,
  type BallotEntry,
} from '../../src/lib/vote-ballot'

/**
 * C09 — unit test della canonicalizzazione `ballot_hash` (lato TS).
 * Deve combaciare byte-per-byte con `public.submit_vote_v2` (SQL).
 */

const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'
const C = 'cccccccc-0000-0000-0000-000000000003'

const BALLOT: BallotEntry[] = [
  { companyId: A, pallet: 1 },
  { companyId: B, pallet: 4 },
  { companyId: C, pallet: 2 },
]

describe('vote-ballot canonicalization', () => {
  it('è order-independent: ogni permutazione produce lo stesso hash', () => {
    const permutations: BallotEntry[][] = [
      [BALLOT[0], BALLOT[1], BALLOT[2]],
      [BALLOT[0], BALLOT[2], BALLOT[1]],
      [BALLOT[1], BALLOT[0], BALLOT[2]],
      [BALLOT[1], BALLOT[2], BALLOT[0]],
      [BALLOT[2], BALLOT[0], BALLOT[1]],
      [BALLOT[2], BALLOT[1], BALLOT[0]],
    ]
    const hashes = permutations.map((p) => ballotHash(p))
    expect(new Set(hashes).size).toBe(1)
    expect(hashes[0]).toBe(ballotHash(BALLOT))
  })

  it('è versionato (prefisso v1) e deterministico (vettore noto)', () => {
    expect(BALLOT_HASH_VERSION).toBe('v1')
    expect(canonicalBallotPayload(BALLOT)).toBe(
      `v1|${A}:1|${B}:4|${C}:2`,
    )
    expect(ballotHash(BALLOT)).toBe(
      'v1:c5cf36b64d0a2f3a7e5f7f6d55b9fddbb04e24e6be0f368159f4036d2283d912',
    )
  })

  it('normalizza gli UUID a lowercase (equivalente al cast ::uuid di Postgres)', () => {
    const upper = BALLOT.map((e) => ({
      companyId: e.companyId.toUpperCase(),
      pallet: e.pallet,
    }))
    expect(ballotHash(upper)).toBe(ballotHash(BALLOT))
  })

  it('ordina per company_id indipendentemente dall’ordine dei pallet', () => {
    const reordered = canonicalizeBallot([
      { companyId: C, pallet: 2 },
      { companyId: A, pallet: 1 },
      { companyId: B, pallet: 4 },
    ])
    expect(reordered.map((e) => e.companyId)).toEqual([A, B, C])
  })

  it('rifiuta schede non valide', () => {
    expect(() => ballotHash([BALLOT[0], BALLOT[1]] as BallotEntry[])).toThrow(/3 elementi/)
    expect(() =>
      ballotHash([BALLOT[0], { ...BALLOT[1], companyId: A }, BALLOT[2]]),
    ).toThrow(/duplicate/)
    expect(() =>
      ballotHash([BALLOT[0], BALLOT[1], { ...BALLOT[2], pallet: 3 as never }]),
    ).toThrow(/pallet non valido/)
    expect(() =>
      ballotHash([BALLOT[0], BALLOT[1], { ...BALLOT[2], pallet: 1 }]),
    ).toThrow(/pallet duplicati/)
    expect(() =>
      ballotHash([BALLOT[0], BALLOT[1], { ...BALLOT[2], companyId: 'non-uuid' }]),
    ).toThrow(/companyId non valido/)
  })
})
