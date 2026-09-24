'use client'

/**
 * C06 — Bootstrap sessione + CSRF lato client.
 *
 * Il cookie di sessione `fantacer_session` è HttpOnly: il client non lo legge
 * né lo gestisce. L'unica credenziale client-side è il **CSRF token**, che il
 * server restituisce nel JSON di `POST /api/identity/bootstrap`. Il token non
 * è mai persistito (né cookie né localStorage): vive in memoria per la durata
 * della pagina e viaggia in `X-CSRF-Token`.
 *
 * `ensureSession` esegue il flusso di bootstrap:
 *   1. `GET /api/identity/bootstrap/nonce` → `{ nonce, cData }`;
 *   2. il chiamante fornisce un token Turnstile con action `bootstrap` legato
 *      a quel `cData` (widget);
 *   3. `POST /api/identity/bootstrap` con `{ turnstile_token, cData }` → salva
 *      `csrfToken`.
 *
 * È **fail-soft**: qualsiasi esito non-ok ritorna `false` senza lanciare, così
 * il chiamante può proseguire sul percorso legacy (modalità identità `off`:
 * gli endpoint rispondono 404 e non cambia nulla).
 *
 * Il modulo non tocca `window` all'import (SSR-safe) e non crea nuove superfici
 * di persistenza.
 */

export interface BootstrapTurnstileProof {
  token: string
  cData: string
}

/** Fornisce un token Turnstile action `bootstrap` legato a `cData`. */
export type BootstrapTokenProvider = (cData: string) => Promise<BootstrapTurnstileProof | null>

/** Header del double-submit CSRF, allineato a `src/lib/vote-csrf.ts`. */
export const CSRF_HEADER = 'X-CSRF-Token'

const NONCE_URL = '/api/identity/bootstrap/nonce'
const BOOTSTRAP_URL = '/api/identity/bootstrap'

let csrfToken: string | null = null

export function getCsrfToken(): string | null {
  return csrfToken
}

/** Imposta il token. Un valore vuoto/null lascia invariato lo stato. */
export function setCsrfToken(token: string | null | undefined): void {
  if (typeof token === 'string' && token.length > 0) csrfToken = token
}

/** Azzera il token (logout, 403 da CSRF, test). */
export function clearCsrfToken(): void {
  csrfToken = null
}

/**
 * Aggiunge l'header CSRF senza dipendere da `Headers` (assente in alcuni
 * ambienti/test): supporta record, array di coppie e `Headers` quando presente.
 * Non sovrascrive un header già impostato dal chiamante.
 */
function withCsrfHeader(headers: HeadersInit | undefined, value: string): HeadersInit {
  const has = (name: string): boolean => {
    if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.has(name)
    if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === name.toLowerCase())
    if (headers) return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase())
    return false
  }

  if (has(CSRF_HEADER)) return headers as HeadersInit

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const next = new Headers(headers)
    next.set(CSRF_HEADER, value)
    return next
  }
  if (Array.isArray(headers)) return [...headers, [CSRF_HEADER, value]]
  return { ...((headers as Record<string, string> | undefined) ?? {}), [CSRF_HEADER]: value }
}

/**
 * `fetch` con `X-CSRF-Token` quando disponibile. Senza token si comporta
 * esattamente come `fetch` (percorso legacy). Non ritenta: un eventuale 403
 * CSRF è responsabilità del chiamante.
 */
export function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = csrfToken
  if (!token) return fetch(input, init)
  return fetch(input, { ...init, headers: withCsrfHeader(init?.headers, token) })
}

/**
 * Assicura una sessione client e il relativo CSRF token. Ritorna `true` se un
 * token è già presente o se il bootstrap è riuscito, `false` su qualunque
 * esito non-ok (endpoint assente/404, rate limit, Turnstile fallita, errore di
 * rete). Non lancia mai.
 */
export async function ensureSession(turnstileTokenProvider: BootstrapTokenProvider): Promise<boolean> {
  if (csrfToken) return true

  try {
    const nonceRes = await fetch(NONCE_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!nonceRes.ok) return false

    const nonceData = (await nonceRes.json()) as { cData?: unknown } | null
    const cData = nonceData && typeof nonceData.cData === 'string' ? nonceData.cData : null
    if (!cData) return false

    const proof = await turnstileTokenProvider(cData)
    if (!proof || typeof proof.token !== 'string' || proof.token.length === 0) return false

    const res = await fetch(BOOTSTRAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ turnstile_token: proof.token, cData }),
    })
    if (!res.ok) return false

    const data = (await res.json()) as { csrfToken?: unknown } | null
    if (!data || typeof data.csrfToken !== 'string' || data.csrfToken.length === 0) return false

    csrfToken = data.csrfToken
    return true
  } catch {
    return false
  }
}
