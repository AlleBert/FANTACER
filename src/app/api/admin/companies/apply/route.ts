import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { writeAuditEvent } from '@/lib/audit'
import { getTrustedClientIp } from '@/lib/request-ip'
import { parseCompanyAction } from '@/lib/company-admin-request'
import type { CompanyAction } from '@/lib/company-admin-projection'

function labelFor(action: CompanyAction): string {
  const parts: string[] = []
  if (action.deleteVotes) parts.push('delete-votes')
  if (action.score === null) parts.push('clear-score')
  else if (action.score) parts.push(`set-score:${action.score.pallets}/${action.score.votes}`)
  if (action.blocked !== undefined) parts.push(action.blocked ? 'block' : 'unblock')
  return parts.join(',') || 'action'
}

/**
 * Applica un'azione admin. Crea SEMPRE un backup dello stato (in DB) prima di
 * qualunque scrittura, così ogni azione è reversibile. Ordine: delete voti →
 * punteggio → blocco (identico alla preview).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRoleAdmin(request)

    const body = await request.json().catch(() => null)
    const parsed = parseCompanyAction(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { action } = parsed
    const reason = typeof (body as Record<string, unknown>)?.reason === 'string'
      ? ((body as Record<string, unknown>).reason as string)
      : null

    const supabase = createAdminClient()

    const { data: backup, error: backupError } = await supabase.rpc(
      'admin_backup_company_state',
      { p_company_ids: action.companyIds, p_label: labelFor(action) },
    )
    if (backupError) {
      return NextResponse.json(
        { error: `Backup non riuscito: ${backupError.message}` },
        { status: 500 },
      )
    }

    const results: Record<string, unknown> = { backup }

    if (action.deleteVotes) {
      const { data, error } = await supabase.rpc('admin_delete_company_votes', {
        p_company_ids: action.companyIds,
        p_reason: reason,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.deleteVotes = data
    }

    if (action.score === null) {
      const { data, error } = await supabase.rpc('admin_clear_company_score', {
        p_company_ids: action.companyIds,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.score = data
    } else if (action.score) {
      const { data, error } = await supabase.rpc('admin_set_company_score', {
        p_company_ids: action.companyIds,
        p_pallets: action.score.pallets,
        p_votes: action.score.votes,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.score = data
    }

    if (action.blocked !== undefined) {
      const { data, error } = await supabase.rpc('admin_set_company_blocked', {
        p_company_ids: action.companyIds,
        p_blocked: action.blocked,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.blocked = data
    }

    await writeAuditEvent({
      eventType: 'admin_company_action',
      ipAddress: getTrustedClientIp(request).ip,
      fingerprint: ctx.user.id,
      metadata: {
        company_ids: action.companyIds,
        delete_votes: action.deleteVotes === true,
        blocked: action.blocked ?? null,
        score: action.score ?? null,
        reason,
        results,
      },
    })

    return NextResponse.json({ success: true, results })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
        { status },
      )
    }
    console.error('company apply error:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
