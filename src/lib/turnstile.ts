/**
 * Verifica server-side di Cloudflare Turnstile (fail-closed).
 *
 * Regole di sicurezza:
 *  - il secret è obbligatorio: se manca la verifica fallisce;
 *  - le testing key Cloudflare sono rifiutate di default e **sempre** su
 *    qualsiasi deployment Vercel (production e preview, dove `VERCEL` è
 *    impostato), anche se il flag E2E fosse accidentalmente presente;
 *  - l'unica eccezione è l'harness E2E **locale**: testing key ammessa solo se
 *    `VERCEL` è assente **e** `E2E_ALLOW_TURNSTILE_TEST_KEYS === 'true'`
 *    (variabile server-only, mai `NEXT_PUBLIC_*`, impostata solo nel processo
 *    webServer di Playwright);
 *  - Siteverify ha un timeout esplicito (AbortController): timeout, errore di
 *    rete, HTTP non valido o JSON malformato falliscono;
 *  - si richiede `success === true`, `action === "vote"` e `hostname` in
 *    allowlist esatta (nessuna wildcard);
 *  - non si usa l'IP per la decisione (estrazione attendibile in P0-2);
 *  - nessun log di token/secret o della risposta completa di Siteverify.
 */

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_ACTION = 'vote';
export const TURNSTILE_TIMEOUT_MS = 4500;

export type TurnstileFailureReason =
  | 'missing_token'
  | 'missing_secret'
  | 'test_key_not_allowed'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'invalid_json'
  | 'verification_failed'
  | 'action_mismatch'
  | 'hostname_not_allowed';

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: TurnstileFailureReason };

const CLOUDFLARE_TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

/** True per i secret di test pubblici Cloudflare (prefisso 1x/2x/3x o noti). */
export function isTestTurnstileSecret(secret: string): boolean {
  return /^[123]x/.test(secret) || CLOUDFLARE_TEST_SECRETS.has(secret);
}

/** Allowlist hostname: split su virgola, trim, lowercase. */
export function parseAllowedHostnames(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

interface SiteverifyOutcome {
  success?: boolean;
  action?: string;
  hostname?: string;
}

export async function verifyTurnstile(token: unknown): Promise<TurnstileResult> {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, reason: 'missing_token' };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const onVercel = Boolean(process.env.VERCEL);
  const testingSecret = isTestTurnstileSecret(secret);

  // Testing key ammessa SOLO per l'harness E2E locale: VERCEL assente E flag
  // esplicito server-only. Su Vercel la condizione è sempre falsa → rifiuto.
  const allowTestKeys =
    !onVercel && process.env.E2E_ALLOW_TURNSTILE_TEST_KEYS === 'true';

  if (testingSecret && !allowTestKeys) {
    return { ok: false, reason: 'test_key_not_allowed' };
  }

  if (testingSecret) {
    // Harness E2E locale: verifica deterministica, nessuna chiamata di rete.
    return { ok: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, reason: aborted ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { ok: false, reason: 'http_error' };
  }

  let outcome: SiteverifyOutcome;
  try {
    outcome = (await response.json()) as SiteverifyOutcome;
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  if (outcome?.success !== true) {
    return { ok: false, reason: 'verification_failed' };
  }

  if (outcome.action !== TURNSTILE_ACTION) {
    return { ok: false, reason: 'action_mismatch' };
  }

  const allowedHostnames = parseAllowedHostnames(process.env.TURNSTILE_ALLOWED_HOSTNAMES);
  if (isProduction && allowedHostnames.length === 0) {
    // Configurazione assente in produzione: fail-closed.
    return { ok: false, reason: 'hostname_not_allowed' };
  }
  if (allowedHostnames.length > 0) {
    const hostname = (outcome.hostname ?? '').toLowerCase();
    if (!allowedHostnames.includes(hostname)) {
      return { ok: false, reason: 'hostname_not_allowed' };
    }
  }

  return { ok: true };
}
