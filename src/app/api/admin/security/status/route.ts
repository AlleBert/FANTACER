import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, toAdminError } from '@/lib/admin-auth'
import { sessionIdentityMode } from '@/lib/session-identity-server'
import {
  classifyVoteHealth,
  computeTotalsDrift,
  summarizeNonces,
  type NoncesSummary,
  type TotalsDrift,
  type VoteHealth,
} from '@/lib/admin-security-status'

export const dynamic = 'force-dynamic'

const UNAVAILABLE = 'unavailable'
const VOTE_PROBE_TIMEOUT_MS = 5000

/**
 * Pallet per voto accepted: le colonne `pallet1/2/3` sono vincolate a 4/2/1
 * (CHECK), quindi la somma per riga è sempre 7. Contiamo gli accepted con un
 * `count(*)` e ricaviamo la somma senza leggere tutte le righe.
 */
const PALLETS_PER_ACCEPTED_VOTE = 4 + 2 + 1

type Admin = SupabaseClient

interface SectionError {
  error: string
}

function authErrorMessage(status: number): string {
  return status === 401 ? 'Non autorizzato' : 'Accesso negato'
}

async function readNonces(admin: Admin): Promise<NoncesSummary> {
  const now = new Date().toISOString()
  const [totalRes, consumedRes, expiredRes] = await Promise.all([
    admin.from('bootstrap_nonces').select('nonce', { count: 'exact', head: true }),
    admin
      .from('bootstrap_nonces')
      .select('nonce', { count: 'exact', head: true })
      .not('consumed_at', 'is', null),
    admin
      .from('bootstrap_nonces')
      .select('nonce', { count: 'exact', head: true })
      .lt('expires_at', now),
  ])

  if (totalRes.error || consumedRes.error || expiredRes.error) {
    throw new Error('bootstrap_nonces_unavailable')
  }

  const total = totalRes.count ?? 0
  const consumed = consumedRes.count ?? 0
  const expired = expiredRes.count ?? 0
  const outstanding = Math.max(0, total - consumed - expired)

  return summarizeNonces({ total, consumed, expired, outstanding })
}

async function readTotalsDrift(admin: Admin): Promise<TotalsDrift> {
  const [totalsRes, acceptedRes] = await Promise.all([
    admin.from('company_totals').select('total_pallets'),
    admin
      .from('vote_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted'),
  ])

  if (totalsRes.error || acceptedRes.error) {
    throw new Error('totals_drift_unavailable')
  }

  const rows = (totalsRes.data ?? []) as Array<{ total_pallets?: number | string | null }>
  const totalsSum = rows.reduce((sum, row) => sum + Number(row.total_pallets ?? 0), 0)
  const acceptedSum = (acceptedRes.count ?? 0) * PALLETS_PER_ACCEPTED_VOTE

  return computeTotalsDrift({ totalsSum, acceptedSum })
}

async function probeVoteHealth(request: NextRequest): Promise<VoteHealth> {
  try {
    const res = await fetch(`${request.nextUrl.origin}/api/vota`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: 'omit',
      signal: AbortSignal.timeout(VOTE_PROBE_TIMEOUT_MS),
    })
    return classifyVoteHealth({ status: res.status, contentType: res.headers.get('content-type') })
  } catch {
    return { ok: false, kind: 'other' }
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json({ error: authErrorMessage(status) }, { status })
  }

  const admin = createAdminClient()
  const identityMode = sessionIdentityMode()

  let nonces: NoncesSummary | SectionError
  try {
    nonces = await readNonces(admin)
  } catch {
    nonces = { error: UNAVAILABLE }
  }

  let totalsDrift: TotalsDrift | SectionError
  try {
    totalsDrift = await readTotalsDrift(admin)
  } catch {
    totalsDrift = { error: UNAVAILABLE }
  }

  const voteHealth = await probeVoteHealth(request)

  return NextResponse.json(
    { identityMode, nonces, totalsDrift, voteHealth },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
