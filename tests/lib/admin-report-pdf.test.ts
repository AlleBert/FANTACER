/**
 * @jest-environment node
 */
import { buildRangeReport, type ReportSessionRow } from '@/lib/admin-analytics'
import { renderRangeReportPdf } from '@/lib/admin-report-pdf'

const session = (
  created_at: string,
  fingerprint: string,
  companies: [string, string, string],
): ReportSessionRow => ({
  created_at,
  fingerprint,
  company1_id: companies[0],
  company2_id: companies[1],
  company3_id: companies[2],
  pallet1: 4,
  pallet2: 2,
  pallet3: 1,
  country: 'IT',
})

const NAMES = new Map([
  ['c1', 'Uno'],
  ['c2', 'Due'],
  ['c3', 'Tre'],
  ['c4', 'Quattro'],
])

const now = new Date('2026-09-23T18:00:00Z')

describe('renderRangeReportPdf', () => {
  it('produce un PDF A4 non vuoto con intestazione %PDF', async () => {
    const report = buildRangeReport(
      [
        session('2026-09-21T09:00:00Z', 'fp-a', ['c1', 'c2', 'c3']),
        session('2026-09-22T10:00:00Z', 'fp-b', ['c1', 'c2', 'c4']),
      ],
      NAMES,
      ['2026-09-21', '2026-09-22'],
      now,
    )
    const buffer = await renderRangeReportPdf(report, 'Fiera')
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('produce un PDF anche senza dati nel periodo', async () => {
    const report = buildRangeReport([], NAMES, ['2026-09-21'], now)
    const buffer = await renderRangeReportPdf(report, 'Tutti i batch')
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })
})
