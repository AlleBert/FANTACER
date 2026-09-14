/**
 * Dev-only bypass for the daily vote limit (once-per-day on visitorId).
 *
 * Active only when ALL of the following hold:
 *  - NODE_ENV !== 'production'  (never on Vercel/next start builds)
 *  - process.env.DEV_BYPASS_VOTE_LIMIT === '1'  (set ONLY in .env.local)
 *
 * The env var is server-only (no NEXT_PUBLIC_ prefix) so it never reaches
 * the client bundle. Removal before going live: delete this file, remove the
 * single import in /api/vota, and delete the env line from .env.local.
 *
 * Nota: con il bypass attivo il restore del voto (`/api/vota/status`) è disattivato
 * per design; per testarlo impostare DEV_BYPASS_VOTE_LIMIT=0.
 */

export function isVoteLimitBypassed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_VOTE_LIMIT === '1'
}

export function resolveFingerprint(visitorId: string): string {
  if (isVoteLimitBypassed()) {
    console.log('[dev] voto: limite giornaliero disattivato (fingerprint random)')
    return crypto.randomUUID()
  }
  return visitorId
}