import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import {
  buildRangeReport,
  enumerateDayKeys,
  filterSessionsByBatch,
  romeDateKey,
  sanitizeCsvValue,
  type ReportSessionRow,
} from '@/lib/admin-analytics'
import { mapSummaryRpc } from '@/lib/admin-analytics-rpc'
import { renderRangeReportPdf } from '@/lib/admin-report-pdf'
import { fetchAllRows } from '@/lib/fetch-all'

type AdminClient = ReturnType<typeof createAdminClient>

const ONLINE_WINDOW_MS = 5 * 60 * 1000

type RawSession = ReportSessionRow & { id: number; user_agent: string | null }

const RAW_SELECT =
  'id, created_at, fingerprint, country, user_agent, company1_id, company2_id, company3_id, pallet1, pallet2, pallet3'

/** Set delle company del batch, oppure null quando il filtro è "tutti". */
async function getBatchCompanyIds(
  supabase: AdminClient,
  batch: string | null,
): Promise<Set<string> | null> {
  if (!batch || batch === 'all') return null
  const { data } = await supabase.from('companies').select('id').eq('batch', batch)
  return new Set((data || []).map((c: { id: string }) => c.id))
}

async function loadRawSessions(supabase: AdminClient, batch: string | null): Promise<RawSession[]> {
  const batchIds = await getBatchCompanyIds(supabase, batch)
  const { data, error } = await fetchAllRows<RawSession>((from, to) =>
    supabase
      .from('vote_sessions')
      .select(RAW_SELECT)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
  if (error) throw new Error(error)
  return filterSessionsByBatch(data, batch, batchIds ?? new Set())
}

async function loadCompanyMap(supabase: AdminClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('companies').select('id, name')
  return new Map((data || []).map((c: { id: string; name: string }) => [c.id, c.name]))
}

/** Tiene solo le sessioni il cui giorno (Europe/Rome) è nell'intervallo. */
function filterByRomeRange<T extends { created_at: string }>(sessions: T[], dayKeys: string[]): T[] {
  const allowed = new Set(dayKeys)
  return sessions.filter((s) => allowed.has(romeDateKey(new Date(s.created_at))))
}

function buildRawTable(sessions: RawSession[], companyMap: Map<string, string>) {
  const header = [
    'fingerprint', 'timestamp', 'country', 'user_agent',
    'company1', 'pallet1', 'company2', 'pallet2', 'company3', 'pallet3',
  ]
  const body = sessions.map((v) => [
    v.fingerprint,
    v.created_at,
    v.country || '',
    v.user_agent || '',
    companyMap.get(v.company1_id) || v.company1_id,
    v.pallet1,
    companyMap.get(v.company2_id) || v.company2_id,
    v.pallet2,
    companyMap.get(v.company3_id) || v.company3_id,
    v.pallet3,
  ])
  return { header, body }
}

function buildCsv(header: string[], body: (string | number)[][]): string {
  return [header.join(','), ...body.map((row) => row.map(sanitizeCsvValue).join(','))].join('\n')
}

function buildXlsx(header: string[], body: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = header.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Voti')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/**
 * Intervallo di giorni (Europe/Rome). Default: oggi. Se i parametri sono
 * invalidi o l'intervallo è troppo ampio, ricade su oggi.
 */
function resolveRange(
  fromParam: string | null,
  toParam: string | null,
): { from: string; to: string; dayKeys: string[] } {
  const today = romeDateKey(new Date())
  const dayKeys = enumerateDayKeys(fromParam || today, toParam || today)
  if (dayKeys.length === 0) return { from: today, to: today, dayKeys: [today] }
  return { from: dayKeys[0], to: dayKeys[dayKeys.length - 1], dayKeys }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const batch = searchParams.get('batch')

    // Export massivo e bundle (raw + PDF) sono privilegiati: solo admin (MFA aal2).
    if (type === 'export' || type === 'bundle') {
      await requireRoleAdmin(request)
    }
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    if (type === 'summary') {
      const fiveMinsAgo = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
      const [summaryRes, onlineRes] = await Promise.all([
        supabase.rpc('admin_analytics_summary', { p_batch: batch ?? null }),
        supabase
          .from('device_sessions')
          .select('*', { count: 'exact', head: true })
          .gte('last_used', fiveMinsAgo),
      ])
      if (summaryRes.error) {
        return NextResponse.json({ error: summaryRes.error.message }, { status: 500 })
      }
      const summary = { ...mapSummaryRpc(summaryRes.data), onlineUsers: onlineRes.count || 0 }
      return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (type === 'bundle') {
      const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
      const { from, to, dayKeys } = resolveRange(dateFrom, dateTo)

      const allSessions = await loadRawSessions(supabase, batch)
      const sessions = filterByRomeRange(allSessions, dayKeys)
      const companyMap = await loadCompanyMap(supabase)

      const { header, body } = buildRawTable(sessions, companyMap)
      const base = `fantacer_${from}_${to}`

      const zip = new JSZip()
      if (format === 'xlsx') {
        zip.file(`${base}_voti.xlsx`, buildXlsx(header, body))
      } else {
        zip.file(`${base}_voti.csv`, buildCsv(header, body))
      }

      const batchLabel = batch && batch !== 'all' ? batch : 'Tutti i batch'
      const report = buildRangeReport(sessions, companyMap, dayKeys)
      const pdf = await renderRangeReportPdf(report, batchLabel)
      zip.file(`${base}_riepilogo.pdf`, pdf)

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename=${base}.zip`,
        },
      })
    }

    if (type === 'detailed') {
      const query = supabase
        .from('analytics_raw')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dateFrom) query.gte('created_at', dateFrom)
      if (dateTo) query.lte('created_at', dateTo)

      const { data, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || [] })
    }

    if (type === 'export') {
      const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
      const sessions = await loadRawSessions(supabase, batch)
      const companyMap = await loadCompanyMap(supabase)
      const { header, body } = buildRawTable(sessions, companyMap)

      if (format === 'xlsx') {
        return new NextResponse(new Uint8Array(buildXlsx(header, body)), {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=fantacer_export.xlsx',
          },
        })
      }

      return new NextResponse(buildCsv(header, body), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=fantacer_export.csv',
        },
      })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (error) {
    const status = toAdminError(error)
    if (status !== 500) {
      return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
    }
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
