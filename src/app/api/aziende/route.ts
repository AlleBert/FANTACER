import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBatch } from '@/lib/supabase/batch'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const activeBatch = await getActiveBatch()

    let dbQuery = supabase
      .from('companies')
      .select('id, name, category, image_url, description', { count: 'exact' })
      .eq('batch', activeBatch)
      .order('name')
      .range(offset, offset + limit - 1)

    if (query) {
      dbQuery = dbQuery.ilike('name', `%${query}%`)
    }

    const { data, count, error } = await dbQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}