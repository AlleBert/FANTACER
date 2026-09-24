import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { getTrustedClientIp } from '@/lib/request-ip'

/** Crea un backup manuale dello stato attuale (batch attivo o aziende scelte). */
export async function POST(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const body = await request.json().catch(() => null)
    const label =
      typeof body?.label === 'string' && body.label.trim() !== ''
        ? body.label.trim()
        : 'backup manuale'
    const companyIds: string[] | null = Array.isArray(body?.companyIds)
      ? body.companyIds.filter((id: unknown): id is string => typeof id === 'string')
      : null

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_backup_company_state', {
      p_company_ids: companyIds && companyIds.length > 0 ? companyIds : null,
      p_label: label,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditEvent({
      eventType: 'admin_company_backup',
      ipAddress: getTrustedClientIp(request).ip,
      metadata: { label, company_ids: companyIds, result: data },
    })

    return NextResponse.json({ success: true, backup: data })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
        { status },
      )
    }
    console.error('company backup error:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
