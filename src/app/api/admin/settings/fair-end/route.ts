import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import {
  DEFAULT_FAIR_END_CONFIG,
  isValidTime,
  parseFairEndConfig,
  resolveRevealAt,
  type FairEndCeremony,
} from '@/lib/fair-end'

const ERROR = (status: number) => (status === 401 ? 'Non autorizzato' : 'Accesso negato')

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['fair_end_enabled', 'fair_end_config'])
    if (error) throw error
    let enabled = false
    let config = { ...DEFAULT_FAIR_END_CONFIG }
    for (const row of data ?? []) {
      if (row.key === 'fair_end_enabled') enabled = row.value === 'true'
      if (row.key === 'fair_end_config') config = parseFairEndConfig(row.value)
    }
    return NextResponse.json({
      enabled,
      revealTime: config.revealTime,
      revealAt: config.revealAt,
      ceremony: config.ceremony,
    })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) return NextResponse.json({ error: ERROR(status) }, { status })
    console.error('Errore lettura fair_end:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRoleAdmin(request)
    const body = await request.json().catch(() => null)
    const enabled = body?.enabled === true
    const revealTime = body?.revealTime
    if (!isValidTime(revealTime)) {
      return NextResponse.json({ error: 'Orario rivelazione non valido' }, { status: 400 })
    }
    const c = (body?.ceremony ?? {}) as Record<string, unknown>
    const ceremony: FairEndCeremony = {
      '1': isValidTime(c['1']) ? (c['1'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['1'],
      '2': isValidTime(c['2']) ? (c['2'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['2'],
      '3': isValidTime(c['3']) ? (c['3'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['3'],
    }
    const revealAt = resolveRevealAt(revealTime, new Date())
    const config = { revealTime, revealAt, ceremony }
    const now = new Date().toISOString()

    const supabase = createAdminClient()
    const { error: e1 } = await supabase
      .from('site_settings')
      .upsert(
        [
          { key: 'fair_end_enabled', value: enabled ? 'true' : 'false', updated_at: now },
          { key: 'fair_end_config', value: JSON.stringify(config), updated_at: now },
        ],
        { onConflict: 'key' },
      )
    if (e1) throw e1

    return NextResponse.json({ success: true, revealAt })
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) return NextResponse.json({ error: ERROR(status) }, { status })
    console.error('Errore aggiornamento fair_end:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
