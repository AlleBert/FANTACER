import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { getActiveBatch } from '@/lib/supabase/batch'
import { fetchAllRows } from '@/lib/fetch-all'
import { parseCompanyAction } from '@/lib/company-admin-request'
import {
  projectCompanyAction,
  type CompanyLite,
  type LiveTotals,
  type ScoreOverride,
  type SessionLite,
} from '@/lib/company-admin-projection'

/**
 * Preview di un'azione admin sulle aziende: classifica prima/dopo e impatto,
 * senza scrivere nulla. L'ordine di applicazione è: delete voti → punteggio →
 * blocco, identico a `/apply`.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRoleAdmin(request)

    const body = await request.json().catch(() => null)
    const parsed = parseCompanyAction(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { action } = parsed

    const supabase = createAdminClient()
    const batch = await getActiveBatch()

    const [companiesRes, totalsRes, overridesRes] = await Promise.all([
      supabase.from('companies').select('id, name, blocked').eq('batch', batch),
      supabase.from('company_totals').select('company_id, total_pallets, vote_count'),
      supabase.from('company_score_overrides').select('*'),
    ])
    if (companiesRes.error) {
      return NextResponse.json({ error: companiesRes.error.message }, { status: 500 })
    }

    const live = new Map<string, LiveTotals>(
      (totalsRes.data ?? []).map((t) => [
        t.company_id,
        { pallets: Number(t.total_pallets), votes: Number(t.vote_count) },
      ]),
    )

    const overrides = new Map<string, ScoreOverride>(
      (overridesRes.data ?? []).map((o) => [
        o.company_id,
        {
          companyId: o.company_id,
          basePallets: Number(o.base_pallets),
          baseVotes: Number(o.base_votes),
          snapshotPallets: Number(o.snapshot_pallets),
          snapshotVotes: Number(o.snapshot_votes),
        },
      ]),
    )

    let sessions: SessionLite[] = []
    if (action.deleteVotes) {
      const { data, error } = await fetchAllRows<{
        company1_id: string
        company2_id: string
        company3_id: string
        pallet1: number
        pallet2: number
        pallet3: number
      }>((from, to) =>
        supabase
          .from('vote_sessions')
          .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3')
          .order('id', { ascending: false })
          .range(from, to),
      )
      if (error) {
        return NextResponse.json({ error }, { status: 500 })
      }
      sessions = data.map((s) => ({
        company1Id: s.company1_id,
        company2Id: s.company2_id,
        company3Id: s.company3_id,
        pallet1: s.pallet1,
        pallet2: s.pallet2,
        pallet3: s.pallet3,
      }))
    }

    const companies: CompanyLite[] = (companiesRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      blocked: c.blocked === true,
    }))

    return NextResponse.json(projectCompanyAction({ companies, live, overrides, sessions, action }))
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}
