import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

interface CompanyStatRow {
  id: string
  name: string
  category: string | null
  image_url: string | null
  effective_pallets: number
  effective_votes: number
  today_votes: number
  yesterday_votes: number
  blocked: boolean
  has_override: boolean
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const batch = searchParams.get('batch')

    const { data, error } = await supabase.rpc('admin_company_stats', { p_batch: batch ?? null })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = ((data ?? []) as CompanyStatRow[])
      .filter((c) => !search || c.name.toLowerCase().includes(search))
      .sort((a, b) => b.effective_pallets - a.effective_pallets)

    const result = rows.map((c, i) => ({
      rank: i + 1,
      id: c.id,
      name: c.name,
      category: c.category || '-',
      image_url: c.image_url,
      votes: Number(c.effective_pallets),
      trend: Number(c.today_votes) - Number(c.yesterday_votes),
      blocked: c.blocked === true,
      manualScore: c.has_override === true,
    }))

    return NextResponse.json({ data: result })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
      { status },
    )
  }
}
