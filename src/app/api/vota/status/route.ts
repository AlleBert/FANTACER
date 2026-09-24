import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isVoteLimitBypassed } from '@/lib/vote-dev-bypass'
import { resolveVoterKey, applyVoterCookie } from '@/lib/vote-identity-server'
import { keyringFromEnv } from '@/lib/session-identity'
import { verifyCsrfForRequest } from '@/lib/vote-csrf'
import { sessionIdentityMode, resolveVoteIdentity, touchSession } from '@/lib/session-identity-server'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const voterId = body?.voterId

    // Stesso resolver di /api/vota: cookie first-party > voterId nel payload.
    const resolved = resolveVoterKey(request, voterId)
    if (!resolved) {
      return NextResponse.json(
        { error: 'voterId is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const respond = (payload: unknown, status = 200) => {
      const response = NextResponse.json(payload, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      })
      applyVoterCookie(response, resolved.voterId)
      return response
    }

    if (isVoteLimitBypassed()) {
      // DEV ONLY (DEV_BYPASS_VOTE_LIMIT=1): la chiave di voto è randomizzata,
      // quindi nessuna sessione può essere riconosciuta; restore disattivato.
      // Set DEV_BYPASS_VOTE_LIMIT=0 per esercitare il restore in locale.
      return respond({ voted: false, bypassed: true, voterId: resolved.voterId })
    }

    const supabase = createAdminClient()

    // C05 — CSRF session-bound (§4-bis). Solo per chiamate con sessione valida
    // in `dual`/`session`. In `off`/`shadow` la lettura è legacy e non c'è
    // un'autorità di sessione: nessun CSRF applicabile. `voterId` resta
    // accettato (la rimozione è C08).
    const identityMode = sessionIdentityMode()
    if (identityMode !== 'off') {
      const keyring = keyringFromEnv()
      if (keyring) {
        const resolvedSession = await resolveVoteIdentity(supabase, request, keyring)
        if ((identityMode === 'dual' || identityMode === 'session') && resolvedSession) {
          // `/api/vota/status` è una LETTURA: il CSRF session-bound non protegge
          // la risposta, ma solo la scrittura di rinnovo idle (`touchSession`).
          // Fail-closed sulla write: il touch avviene **solo** se il CSRF è
          // valido; altrimenti la lettura prosegue invariata (200). Dopo un
          // reload il token CSRF in-memory è perso: un 403 qui abortirebbe il
          // restore dello stato votato per i returning user senza alcun
          // guadagno di sicurezza — `SameSite=Lax` trattiene già il cookie di
          // sessione sulle POST cross-site e una risposta cross-origin non è
          // leggibile dal chiamante.
          const csrf = verifyCsrfForRequest(request, keyring, resolvedSession)
          if (csrf.ok) {
            await touchSession(supabase, resolvedSession.sessionId)
          }
        }
      }
    }

    const { data: session, error } = await supabase
      .from('vote_sessions')
      .select('company1_id, company2_id, company3_id, pallet1, pallet2, pallet3')
      .eq('fingerprint', resolved.key)
      .eq('vote_day', romeDayKey())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return respond({ error: 'Internal server error' }, 500)
    }

    if (!session) {
      return respond({ voted: false, voterId: resolved.voterId })
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

    return respond({ voted: true, companies: votedCompanies, voterId: resolved.voterId })
  } catch (error) {
    console.error('Vote status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
