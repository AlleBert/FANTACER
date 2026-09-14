import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      // Rimuove i caratteri che rompono la grammatica `or` di PostgREST.
      const safe = search.replace(/[,()]/g, '')
      if (safe) {
        query = query.or(`fingerprint.ilike.%${safe}%,event_type.ilike.%${safe}%`)
      }
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    const status = toAdminError(error)
    if (status !== 500) {
      return NextResponse.json({ error: status === 401 ? 'Non autorizzato' : 'Accesso negato' }, { status })
    }
    console.error('Audit Logs API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
