import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { fingerprint } = await request.json()

    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('device_sessions')
      .upsert(
        { fingerprint, last_used: new Date().toISOString() },
        { onConflict: 'fingerprint', ignoreDuplicates: false }
      )

    if (error) {
      console.error('Heartbeat error:', error)
      return NextResponse.json({ error: 'Failed to record heartbeat' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Heartbeat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
