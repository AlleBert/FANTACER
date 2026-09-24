import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isVoteLimitBypassed } from '@/lib/vote-dev-bypass'
import {
  resolveVoterKey,
  applyVoterCookie,
  type ResolvedVoter,
} from '@/lib/vote-identity-server'
import { keyringFromEnv } from '@/lib/session-identity'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'
import {
  sessionIdentityMode,
  resolveVoteIdentityResult,
  touchSession,
  type SessionResolution,
} from '@/lib/session-identity-server'

interface VoteSessionRow {
  company1_id: string
  company2_id: string
  company3_id: string
  pallet1: number
  pallet2: number
  pallet3: number
}

const romeDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Giorno corrente (YYYY-MM-DD) nel fuso Europe/Rome, coerente con `vote_day`. */
export function romeDayKey(now = new Date()): string {
  return romeDayFormatter.format(now)
}

const NO_STORE = { 'Cache-Control': 'no-store' }

type Admin = ReturnType<typeof createAdminClient>

/**
 * Fingerprint legacy del principal di sessione (per mantenere il dedup legacy).
 * Best-effort: in assenza, fallback stabile `principal:<id>`. Non lancia mai.
 */
async function principalFingerprintFor(admin: Admin, principalId: string): Promise<string> {
  try {
    const { data } = await admin
      .from('event_principals')
      .select('legacy_fingerprint')
      .eq('id', principalId)
      .maybeSingle()
    if (data?.legacy_fingerprint) return data.legacy_fingerprint
  } catch {
    // best-effort: fallback sotto
  }
  return `principal:${principalId}`
}

export async function POST(request: NextRequest) {
  try {
    // C08 — `voterId` è rimosso dal contratto: il body viene letto solo per
    // consumarlo, ma nessun campo di identità è accettato dal payload.
    await request.json().catch(() => null)

    const identityMode = sessionIdentityMode()
    const supabase = createAdminClient()

    let resolved: ResolvedVoter | null = null
    let fingerprintKey: string | null = null

    if (identityMode === 'off' || identityMode === 'shadow') {
      // Lettura legacy: solo cookie first-party.
      resolved = resolveVoterKey(request)
      if (!resolved) {
        return NextResponse.json(
          { error: 'voterId is required' },
          { status: 400, headers: NO_STORE },
        )
      }
      fingerprintKey = resolved.key
    } else {
      // dual | session: la sessione è l'autorità (fail-closed).
      const keyring = keyringFromEnv()
      if (!keyring) {
        return NextResponse.json(
          { error: 'identity unavailable' },
          { status: 503, headers: NO_STORE },
        )
      }

      // Esito discriminato: `none` (assenza) vs `error` (DB/rete). Un errore in
      // `dual`/`session` è fail-closed `503`: non va trattato come "nessuna
      // sessione" (che in `dual` ricadrebbe sul legacy e in `session` è già 503).
      let resolution: SessionResolution
      try {
        resolution = await resolveVoteIdentityResult(supabase, request, keyring)
      } catch {
        return NextResponse.json(
          { error: 'identity unavailable' },
          { status: 503, headers: NO_STORE },
        )
      }

      if (resolution.status === 'error') {
        return NextResponse.json(
          { error: 'identity unavailable' },
          { status: 503, headers: NO_STORE },
        )
      }

      if (resolution.status === 'ok') {
        const session = resolution.session
        // `/api/vota/status` è una LETTURA: il CSRF session-bound protegge solo
        // la write di rinnovo idle (`touchSession`). Fail-closed sulla write:
        // il touch avviene solo se il CSRF è valido, la lettura prosegue
        // comunque (dopo un reload il token in-memory è perso).
        const csrf = verifyCsrfForRequest(request, keyring, session)
        if (csrf.ok) {
          await touchSession(supabase, session.sessionId)
        }
        fingerprintKey = await principalFingerprintFor(supabase, session.principalId)
      } else if (identityMode === 'session') {
        // Cutover: nessun fallback legacy.
        return NextResponse.json(
          { error: 'identity unavailable' },
          { status: 503, headers: NO_STORE },
        )
      } else {
        // dual: fallback al cookie legacy first-party (mai body).
        resolved = resolveVoterKey(request)
        if (!resolved) {
          return NextResponse.json(
            { error: 'voterId is required' },
            { status: 400, headers: NO_STORE },
          )
        }
        fingerprintKey = resolved.key
      }
    }

    const respond = (payload: unknown, status = 200) => {
      const response = NextResponse.json(payload, { status, headers: NO_STORE })
      if (resolved) applyVoterCookie(response, resolved.voterId)
      return response
    }

    if (isVoteLimitBypassed()) {
      // DEV ONLY (DEV_BYPASS_VOTE_LIMIT=1): la chiave di voto è randomizzata,
      // quindi nessuna sessione può essere riconosciuta; restore disattivato.
      return respond({
        voted: false,
        bypassed: true,
        ...(resolved ? { voterId: resolved.voterId } : {}),
      })
    }

    const { data: session, error } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3')
      .eq('fingerprint', fingerprintKey)
      .eq('vote_day', romeDayKey())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return respond({ error: 'Internal server error' }, 500)
    }

    if (!session) {
      return respond({ voted: false, ...(resolved ? { voterId: resolved.voterId } : {}) })
    }

    const row = session as VoteSessionRow
    const ids = [row.company1_id, row.company2_id, row.company3_id]
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', ids)

    if (companiesError) {
      return respond({ error: 'Internal server error' }, 500)
    }

    const nameById = new Map(
      (companies || []).map((c: { id: string; name: string }) => [c.id, c.name]),
    )

    const votedCompanies = [
      { id: row.company1_id, name: nameById.get(row.company1_id) ?? '', pallet: row.pallet1 },
      { id: row.company2_id, name: nameById.get(row.company2_id) ?? '', pallet: row.pallet2 },
      { id: row.company3_id, name: nameById.get(row.company3_id) ?? '', pallet: row.pallet3 },
    ]

    return respond({
      voted: true,
      companies: votedCompanies,
      ...(resolved ? { voterId: resolved.voterId } : {}),
    })
  } catch (error) {
    console.error('Vote status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_STORE },
    )
  }
}
