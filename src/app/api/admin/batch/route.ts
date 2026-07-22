import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('batch_settings')
    .select('active_batch')
    .eq('id', 'default')
    .single()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, batch')
    .not('batch', 'is', null)

  const batchMap = new Map<string, { companyIds: string[] }>()
  for (const c of companies || []) {
    if (!batchMap.has(c.batch)) {
      batchMap.set(c.batch, { companyIds: [] })
    }
    batchMap.get(c.batch)!.companyIds.push(c.id)
  }

  const allCompanyIds = companies?.map(c => c.id) || []
  const voteCountByCompany = new Map<string, number>()

  if (allCompanyIds.length > 0) {
    const { data: sessions } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id')

    for (const s of sessions || []) {
      for (const cId of [s.company1_id, s.company2_id, s.company3_id]) {
        if (allCompanyIds.includes(cId)) {
          voteCountByCompany.set(cId, (voteCountByCompany.get(cId) || 0) + 1)
        }
      }
    }
  }

  const uniqueBatches = Array.from(batchMap.entries()).map(([name, { companyIds }]) => {
    let voteCount = 0
    for (const id of companyIds) {
      voteCount += voteCountByCompany.get(id) || 0
    }
    return { name, companyCount: companyIds.length, voteCount }
  })

  return NextResponse.json({
    activeBatch: settings?.active_batch || 'TEST',
    batches: uniqueBatches,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { activeBatch } = await request.json()

    if (!activeBatch) {
      return NextResponse.json({ error: 'activeBatch required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('batch_settings')
      .update({ active_batch: activeBatch, updated_at: new Date().toISOString() })
      .eq('id', 'default')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Batch updated', activeBatch })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { batchName } = await request.json()

    if (!batchName) {
      return NextResponse.json({ error: 'batchName required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: companyIds } = await supabase
      .from('companies')
      .select('id')
      .eq('batch', batchName)

    if (!companyIds || companyIds.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    const ids = companyIds.map(c => c.id)

    const { error: errAnalytics } = await supabase
      .from('analytics_raw')
      .delete()
      .in('company_id', ids)

    if (errAnalytics) {
      console.error('Delete analytics_raw error (non-fatal):', errAnalytics)
    }

    const { error: errDailyStats } = await supabase
      .from('daily_stats')
      .delete()
      .in('company_id', ids)

    if (errDailyStats) {
      console.error('Delete daily_stats error (non-fatal):', errDailyStats)
    }

    const { error: errCompanies } = await supabase
      .from('companies')
      .delete()
      .eq('batch', batchName)

    if (errCompanies) {
      return NextResponse.json({ error: errCompanies.message }, { status: 500 })
    }

    const { data: settings } = await supabase
      .from('batch_settings')
      .select('active_batch')
      .eq('id', 'default')
      .single()

    if (settings?.active_batch === batchName) {
      await supabase
        .from('batch_settings')
        .update({ active_batch: 'TEST', updated_at: new Date().toISOString() })
        .eq('id', 'default')
    }

    return NextResponse.json({
      message: `Batch "${batchName}" eliminato con ${ids.length} aziende`,
      deletedCompanies: ids.length,
    })
  } catch (error) {
    console.error('Delete batch error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
