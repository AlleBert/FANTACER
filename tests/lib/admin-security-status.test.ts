import {
  computeTotalsDrift,
  summarizeNonces,
  classifyVoteHealth,
} from '@/lib/admin-security-status'

describe('computeTotalsDrift', () => {
  it('allineato quando le somme coincidono', () => {
    expect(computeTotalsDrift({ totalsSum: 100, acceptedSum: 100 })).toEqual({
      drift: 0,
      aligned: true,
    })
  })

  it('divergente con delta (totals - accepted)', () => {
    expect(computeTotalsDrift({ totalsSum: 100, acceptedSum: 94 })).toEqual({
      drift: 6,
      aligned: false,
    })
  })

  it('drift negativo quando accepted supera i totali', () => {
    expect(computeTotalsDrift({ totalsSum: 10, acceptedSum: 25 })).toEqual({
      drift: -15,
      aligned: false,
    })
  })
})

describe('summarizeNonces', () => {
  it('classifica attivi/consumati/scaduti senza allarme', () => {
    expect(
      summarizeNonces({ total: 10, consumed: 4, expired: 3, outstanding: 3 }),
    ).toEqual({
      total: 10,
      consumed: 4,
      expired: 3,
      outstanding: 3,
      suspiciousOutstanding: false,
    })
  })

  it('molti outstanding → sospetto', () => {
    expect(
      summarizeNonces({ total: 100, consumed: 20, expired: 10, outstanding: 70 })
        .suspiciousOutstanding,
    ).toBe(true)
  })

  it('ratio oltre il 50% con total ≥ 20 → sospetto', () => {
    expect(
      summarizeNonces({ total: 20, consumed: 4, expired: 4, outstanding: 12 })
        .suspiciousOutstanding,
    ).toBe(true)
  })

  it('ratio oltre il 50% ma total < 20 → non sospetto', () => {
    expect(
      summarizeNonces({ total: 10, consumed: 1, expired: 1, outstanding: 8 })
        .suspiciousOutstanding,
    ).toBe(false)
  })

  it('outstanding > 50 anche con ratio basso → sospetto', () => {
    expect(
      summarizeNonces({ total: 1000, consumed: 900, expired: 0, outstanding: 100 })
        .suspiciousOutstanding,
    ).toBe(true)
  })
})

describe('classifyVoteHealth', () => {
  it('json 200 → ok, kind json', () => {
    expect(classifyVoteHealth({ status: 200, contentType: 'application/json' })).toEqual({
      ok: true,
      kind: 'json',
    })
  })

  it('json con charset → ok (case-insensitive)', () => {
    expect(
      classifyVoteHealth({ status: 200, contentType: 'Application/JSON; charset=utf-8' }),
    ).toEqual({ ok: true, kind: 'json' })
  })

  it('json 500 → kind json ma non ok', () => {
    expect(
      classifyVoteHealth({ status: 500, contentType: 'application/json' }),
    ).toEqual({ ok: false, kind: 'json' })
    expect(
      classifyVoteHealth({ status: 503, contentType: 'application/json' }),
    ).toEqual({ ok: false, kind: 'json' })
  })

  it('status 0/unknown → non ok anche se json', () => {
    expect(
      classifyVoteHealth({ status: 0, contentType: 'application/json' }),
    ).toEqual({ ok: false, kind: 'json' })
  })

  it('html → ko, kind html (qualsiasi status)', () => {
    expect(classifyVoteHealth({ status: 429, contentType: 'text/html' })).toEqual({
      ok: false,
      kind: 'html',
    })
    expect(classifyVoteHealth({ status: 200, contentType: 'text/html' })).toEqual({
      ok: false,
      kind: 'html',
    })
  })

  it('content-type assente/altro → ko, kind other', () => {
    expect(classifyVoteHealth({ status: 0, contentType: null })).toEqual({
      ok: false,
      kind: 'other',
    })
    expect(classifyVoteHealth({ status: 200, contentType: 'text/plain' })).toEqual({
      ok: false,
      kind: 'other',
    })
  })
})
