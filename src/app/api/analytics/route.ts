import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import {
  aggregateSummary,
  filterSessionsByBatch,
  sanitizeCsvValue,
  type SessionSummaryRow,
} from '@/lib/admin-analytics'

type AdminClient = ReturnType<typeof createAdminClient>

const ONLINE_WINDOW_MS = 5 * 60 * 1000

/** Set delle company del batch, oppure null quando il filtro è "tutti". */
async function getBatchCompanyIds(
  supabase: AdminClient,
  batch: string | null,
): Promise<Set<string> | null> {
  if (!batch || batch === 'all') return null
  const { data } = await supabase.from('companies').select('id').eq('batch', batch)
  return new Set((data || []).map((c: { id: string }) => c.id))
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'
    const batch = searchParams.get('batch')

    // Export (estrazione massiva CSV/Excel) è privilegiato: solo admin (MFA aal2).
    if (type === 'export') {
      await requireRoleAdmin(request)
    }
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')

    if (type === 'summary') {
      const batchIds = await getBatchCompanyIds(supabase, batch)

      const { data: sessions } = await supabase
        .from('vote_sessions')
        .select('created_at, fingerprint, company1_id, company2_id, company3_id')

      const filtered = filterSessionsByBatch(
        (sessions || []) as SessionSummaryRow[],
        batch,
        batchIds ?? new Set(),
      )

      const fiveMinsAgo = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
      const { count: onlineUsers } = await supabase
        .from('device_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('last_used', fiveMinsAgo)

      // Le "voti" sono sessioni (non assegnazioni pallet) e l'aggregazione
      // giornaliera è calcolata dai vote_sessions, non dalle righe per-azienda
      // di daily_stats (che gonfierebbero il conteggio di 3x).
      const summary = aggregateSummary(filtered, onlineUsers || 0)

      return NextResponse.json(summary)
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
      const batchIds = await getBatchCompanyIds(supabase, batch)

      const { data: allSessions } = await supabase
        .from('vote_sessions')
        .select(
          'created_at, fingerprint, country, user_agent, company1_id, company2_id, company3_id, pallet1, pallet2, pallet3',
        )
        .order('created_at', { ascending: false })

      const sessions = filterSessionsByBatch(
        (allSessions || []) as Array<SessionSummaryRow & {
          country: string | null
          user_agent: string | null
          pallet1: number
          pallet2: number
          pallet3: number
        }>,
        batch,
        batchIds ?? new Set(),
      )

      const { data: companies } = await supabase.from('companies').select('id, name')
      const companyMap = new Map(
        (companies || []).map((c: { id: string; name: string }) => [c.id, c.name]),
      )

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

      if (format === 'xlsx') {
        const ws = XLSX.utils.aoa_to_sheet([header, ...body])
        ws['!cols'] = header.map(() => ({ wch: 20 }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Voti')
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buf, {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=fantacer_export.xlsx',
          },
        })
      }

      const csv = [
        header.join(','),
        ...body.map((row) => row.map(sanitizeCsvValue).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
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
