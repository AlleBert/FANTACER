import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditEvent } from '@/lib/audit'

const RECONCILE_RATE_WINDOW_MS = 15 * 60 * 1000
const RECONCILE_RATE_MAX = 20

interface ReconcileResult {
  success: boolean
  code?: string
  message?: string
  changed?: boolean
  companies_changed?: number
  before?: unknown
  after?: unknown
  deltas?: unknown
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRoleAdmin(request)
    const ip = getClientIp(request)

    const allowed = await checkRateLimit(
      `admin:totals-reconcile:${ctx.user.id}`,
      RECONCILE_RATE_WINDOW_MS,
      RECONCILE_RATE_MAX,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'Troppe operazioni. Riprova più tardi.' },
        { status: 429 },
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_reconcile_totals')

    if (error) {
      console.error('admin_reconcile_totals RPC error:', error.message)
      return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }

    const result = data as ReconcileResult
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message ?? 'Riconciliazione fallita' },
        { status: 400 },
      )
    }

    await writeAuditEvent({
      eventType: 'admin_totals_reconcile',
      ipAddress: ip,
      metadata: {
        changed: result.changed ?? null,
        companies_changed: result.companies_changed ?? null,
        before: result.before ?? null,
        after: result.after ?? null,
      },
    })

    return NextResponse.json(result)
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
        { status },
      )
    }
    console.error('Errore riconciliazione totali:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
