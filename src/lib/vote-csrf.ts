import { verifyCsrf, type SessionKeyring } from '@/lib/session-identity'

/**
 * C05 — CSRF session-bound (§4-bis).
 *
 * Double-submit: il client invia il token CSRF in chiaro nell'header
 * `X-CSRF-Token`; il server lo confronta con l'hash HMAC salvato nella riga
 * `voter_sessions.csrf_hash` (`verifyCsrf`, domain `csrf.v1|`). Il token non è
 * mai persistito in chiaro.
 *
 * Difesa aggiuntiva same-origin: se `Origin` è presente deve combaciare con
 * l'host della richiesta (`Host`, oppure `request.nextUrl.origin`).
 *
 * **Origin/Host è difesa-in-profondità, NON il controllo di autorizzazione.**
 * `Origin` è un header controllato dal browser e, in contesti non-browser,
 * falsificabile dal chiamante: da solo non prova nulla. Il controllo di
 * autorizzazione è il **token CSRF session-bound** (double-submit contro
 * `csrf_hash`): Origin/Host riduce la superficie (blocca i form/fetch
 * cross-site dei browser reali) ma non sostituisce il token. Un eventuale
 * **allowlist di origin canonico** (`APP_CANONICAL_ORIGIN`, più origini in
 * preview/staging) irrobustirebbe questo layer; resta **fuori scope** qui.
 * Nota: si confronta solo l'**host** (case-insensitive, con eventuale porta),
 * **non lo scheme** — una downgrade http/https è una minaccia distinta
 * (mixed-content/HSTS), non coperta da questo check.
 *
 * **Decisione fail-closed sull'Origin assente**: su una rotta che modifica
 * stato l'assenza di `Origin` è rifiutata (`reason: 'origin'`). Un browser
 * reale invia sempre `Origin` su POST/fetch same-origin; l'unico caso senza
 * `Origin` è un client non-browser (curl, `APIRequestContext`), che non è
 * soggetto a CSRF ma non è nemmeno un chiamante legittimo di `/api/vota`.
 * I test/route che esercitano il percorso sessione devono quindi impostare un
 * header `Origin` same-origin. Il token resta comunque obbligatorio.
 *
 * Il modulo è puro: nessun accesso DB, testabile con un keyring in memoria.
 */

export const CSRF_HEADER = 'x-csrf-token'

export type CsrfFailureReason = 'missing' | 'invalid' | 'origin'
export type CsrfVerification = { ok: true } | { ok: false; reason: CsrfFailureReason }

/** Riga sessione minima necessaria alla verifica. */
export interface CsrfSessionRow {
  csrfHash: string | null
}

/** Sorgente header minima (NextRequest la soddisfa strutturalmente). */
export interface CsrfRequest {
  headers: { get(name: string): string | null }
  nextUrl?: { origin?: string } | null
}

function requestHost(request: CsrfRequest): string | null {
  const host = request.headers.get('host')
  if (host && host.trim()) return host.trim().toLowerCase()
  const nextOrigin = request.nextUrl?.origin
  if (nextOrigin) {
    try {
      return new URL(nextOrigin).host.toLowerCase()
    } catch {
      return null
    }
  }
  return null
}

/** True se `Origin` è presente ed è same-origin rispetto alla richiesta. */
function isSameOrigin(request: CsrfRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return false
  }
  if (!originHost) return false
  const expected = requestHost(request)
  return expected !== null && originHost === expected
}

/**
 * Verifica Origin/Host + token CSRF contro l'hash di sessione.
 *
 * Precedenza: un `Origin` non same-origin (o assente) è rifiutato per primo;
 * poi un header token assente → `missing`; infine token non verificato →
 * `invalid`. Il chiamante mappa qualsiasi failure su un 403 neutro.
 */
export function verifyCsrfForRequest(
  request: CsrfRequest,
  keyring: SessionKeyring,
  sessionRow: CsrfSessionRow,
): CsrfVerification {
  if (!isSameOrigin(request)) return { ok: false, reason: 'origin' }

  const token = request.headers.get(CSRF_HEADER)
  if (!token) return { ok: false, reason: 'missing' }

  if (!verifyCsrf(token, sessionRow.csrfHash, keyring)) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true }
}
