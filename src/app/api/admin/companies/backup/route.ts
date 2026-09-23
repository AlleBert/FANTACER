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
