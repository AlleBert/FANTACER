import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireRoleAdmin, toAdminError } from '@/lib/admin-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditEvent } from '@/lib/audit'

const REVIEW_STATUSES = ['accepted', 'quarantined', 'rejected'] as const
type ReviewStatus = (typeof REVIEW_STATUSES)[number]

const MAX_REASON_LENGTH = 500
const REVIEW_RATE_WINDOW_MS = 15 * 60 * 1000
const REVIEW_RATE_MAX = 60

// Chiavi che potrebbero contenere PII grezza: mai esposte alla UI. Il resto dei
// `risk_findings` è fixed-schema e server-derived (pseudonimi/HMAC/bucket).
const PII_KEYS = new Set([
  'ip',
  'ip_address',
  'ipAddress',
  'raw_ip',
  'rawIp',
  'user_agent',
  'userAgent',
  'fingerprint',
  'email',
])

interface QuarantineCounts {
  accepted?: number
  quarantined?: number
  rejected?: number
  total?: number
}

interface ReviewResult {
  success: boolean
  code?: string
  message?: string
  vote_id?: number
  previous_status?: string
  status?: string
  changed?: boolean
  idempotent?: boolean
}

/**
 * Riduce `risk_findings` a un riepilogo privo di PII: mantiene solo i campi
 * derivati lato server, scartando eventuali chiavi riconducibili a IP/UA grezzi.
 */
export function summarizeRiskFindings(
  riskFindings: unknown,
): Record<string, unknown> | null {
  if (!riskFindings || typeof riskFindings !== 'object' || Array.isArray(riskFindings)) {
    return null
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(riskFindings as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function normalizeVoteId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) {
    const parsed = Number(value.trim())
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const days = parsePositiveInt(searchParams.get('days'), 30, 365)
    const limit = parsePositiveInt(searchParams.get('limit'), 50, 200)

    const { data: countsData, error: countsError } = await supabase.rpc(
      'admin_quarantine_counts',
      { p_days: days },
    )
    if (countsError) {
      console.error('admin_quarantine_counts RPC error:', countsError.message)
      return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }

    const counts = (countsData as { totals?: QuarantineCounts } | null)?.totals ?? {}
    const byDay =
      (countsData as { by_day?: unknown[] } | null)?.by_day ?? []

    const { data: rows, error } = await supabase
      .from('vote_sessions')
      .select(
        'id, created_at, status, fingerprint, country, review_actor, reviewed_at, review_reason, risk_findings',
      )
      .in('status', ['quarantined', 'rejected'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('admin quarantine list error:', error.message)
      return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }

    const votes = (rows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      createdAt: row.created_at,
      status: row.status,
      fingerprint: row.fingerprint ? String(row.fingerprint).slice(0, 12) : null,
      country: row.country ?? null,
      reviewActor: row.review_actor ?? null,
      reviewedAt: row.reviewed_at ?? null,
      reviewReason: row.review_reason ?? null,
      riskFindings: summarizeRiskFindings(row.risk_findings),
    }))

    return NextResponse.json({
      success: true,
      counts: {
        accepted: counts.accepted ?? 0,
        quarantined: counts.quarantined ?? 0,
        rejected: counts.rejected ?? 0,
        total: counts.total ?? 0,
      },
      byDay,
      votes,
    })
  } catch (e) {
    const status = toAdminError(e)
    return NextResponse.json(
      {
        error:
          status === 401
            ? 'Non autorizzato'
            : status === 403
              ? 'Accesso negato'
              : 'Internal server error',
      },
      { status },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRoleAdmin(request)
    const ip = getClientIp(request)

    const body = await request.json().catch(() => null)
    const voteId = normalizeVoteId(body?.voteId)
    const status = body?.status
    const reason =
      typeof body?.reason === 'string'
        ? body.reason.trim().slice(0, MAX_REASON_LENGTH) || null
        : null

    if (voteId === null) {
      return NextResponse.json({ error: 'voteId non valido' }, { status: 400 })
    }
    if (typeof status !== 'string' || !REVIEW_STATUSES.includes(status as ReviewStatus)) {
      return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })
    }

    const allowed = await checkRateLimit(
      `admin:vote-review:${ctx.user.id}`,
      REVIEW_RATE_WINDOW_MS,
      REVIEW_RATE_MAX,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'Troppe operazioni. Riprova più tardi.' },
        { status: 429 },
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_review_vote', {
      p_vote_id: voteId,
      p_status: status,
      p_actor: ctx.user.email ?? ctx.user.id,
      p_reason: reason,
    })

    if (error) {
      console.error('admin_review_vote RPC error:', error.message)
      return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }

    const result = data as ReviewResult
    if (!result?.success) {
      const notFound = result?.code === 'vote_not_found'
      return NextResponse.json(
        { error: result?.message ?? 'Review fallita' },
        { status: notFound ? 404 : 400 },
      )
    }

    await writeAuditEvent({
      eventType: 'admin_vote_review',
      ipAddress: ip,
      metadata: {
        vote_id: result.vote_id ?? voteId,
        status: result.status ?? status,
        previous_status: result.previous_status ?? null,
        changed: result.changed ?? null,
        idempotent: result.idempotent ?? null,
        reason,
      },
    })

    return NextResponse.json(result)
  } catch (e) {
    const status = toAdminError(e)
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 401 ? 'Non autorizzato' : 'Accesso negato' },
        { status },
      )
    }
    console.error('Errore review voto:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
