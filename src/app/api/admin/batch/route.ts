import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  
  const { data: settings } = await supabase
    .from('batch_settings')
    .select('active_batch')
    .eq('id', 'default')
    .single()

  const { data: batches } = await supabase
    .from('companies')
    .select('batch')
    .not('batch', 'is', null)

  const uniqueBatches = [...new Set((batches || []).map(b => b.batch))]

  return NextResponse.json({
    activeBatch: settings?.active_batch || 'TEST',
    batches: uniqueBatches
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
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}