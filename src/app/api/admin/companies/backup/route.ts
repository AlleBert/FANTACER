import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, requireAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { getTrustedClientIp } from '@/lib/request-ip'

/** Elenca i backup di stato recenti (senza payload) o ne scarica uno (`?id=`). */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const id = new URL(request.url).searchParams.get('id')

    if (id) {
      const { data, error } = await supabase
        .from('admin_state_backups')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ data })
    }

    const { data, error } = await supabase
      .from('admin_state_backups')
      .select('id, created_at, label, batch, company_ids')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}

/** Ripristina lo stato (blocco + punteggi) da un backup. Solo admin (AAL2). */
export async function POST(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const body = await request.json().catch(() => null)
    const restoreBackupId = body?.restoreBackupId
    if (!Number.isInteger(restoreBackupId)) {
      return NextResponse.json({ error: 'restoreBackupId obbligatorio' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_restore_company_state', {
      p_backup_id: restoreBackupId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = data as { success: boolean; error?: string; restored?: number }
    if (!result?.success) {
      return NextResponse.json({ error: result?.error ?? 'Ripristino fallito' }, { status: 400 })
    }

    await writeAuditEvent({
      eventType: 'admin_company_restore',
      ipAddress: getTrustedClientIp(request).ip,
      metadata: { backup_id: restoreBackupId, restored: result.restored },
    })

    return NextResponse.json({ success: true, restored: result.restored })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
        { status },
      )
    }
    console.error('company restore error:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
