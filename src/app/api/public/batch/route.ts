import { NextResponse } from 'next/server'
import { getActiveBatch } from '@/lib/supabase/batch'

export async function GET() {
  try {
    const activeBatch = await getActiveBatch()
    return NextResponse.json({ activeBatch })
  } catch {
    return NextResponse.json({ activeBatch: 'TEST' })
  }
}