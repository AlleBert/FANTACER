import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { getTrustedClientIp } from '@/lib/request-ip'

export async function POST(request: NextRequest) {
  try {
    await requireRoleAdmin(request)

    const body = await request.json().catch(() => null)
    const scope = body?.scope
    const batch = body?.batch ?? null

    if (scope !== 'all' && scope !== 'batch') {
      return NextResponse.json({ error: 'Scope non valido' }, { status: 400 })
    }
    if (scope === 'batch' && (typeof batch !== 'string' || batch.trim() === '')) {
      return NextResponse.json({ error: 'Batch obbligatorio' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_reset_votes', {
      p_scope: scope,
      p_batch: scope === 'batch' ? batch : null,
    })

    if (error) {
      console.error('admin_reset_votes RPC error:', error.message)
      return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }

    const result = data as {
      success: boolean
      votes_deleted?: number
      stats_deleted?: number
      error?: string
    }
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Reset fallito' }, { status: 400 })
    }

    const votesDeleted = result.votes_deleted ?? 0
    const statsDeleted = result.stats_deleted ?? 0

    await writeAuditEvent({
      eventType: 'admin_votes_reset',
      ipAddress: getTrustedClientIp(request).ip,
      metadata: {
        scope,
        batch: scope === 'batch' ? batch : null,
        votes_deleted: votesDeleted,
        stats_deleted: statsDeleted,
      },
    })

    return NextResponse.json({
      success: true,
      votes_deleted: votesDeleted,
      stats_deleted: statsDeleted,
      scope,
      batch: scope === 'batch' ? batch : null,
    })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
    }
    console.error('Errore reset voti:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}