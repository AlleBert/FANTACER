import { createHmac } from 'node:crypto'
import { hmacIp, type ClientIpSignal } from './request-ip'

/**
 * P0-4 / A3 — Segnali di rischio del voto: tipizzati, versionati, derivati
 * **server-side**.
 *
 * Regole di sicurezza (vedi `docs/superpowers/plans/2026-09-24-fine-sicurezza-voto-p0-4-p1.md`
 * §D-segnali):
 * - I valori sensibili (IP, user-agent, ASN, token botd) vengono
 *   **pseudonimizzati con HMAC** sul server: i valori grezzi non vengono mai
 *   restituiti né persistiti.
 * - `country` NON è hashato: è un dato non identificativo di una persona
 *   (areale), sanitizzato a 2 lettere.
 * - `botdBucket` è un bucket 0..3, mai il punteggio grezzo.
 * - Il client non può impostare stato/esito/score: qui si costruiscono solo
 *   segnali da input già osservati dal server.
 *
 * Modulo **server-only** (usa `node:crypto`): non importarlo in componenti
 * client. Il repo non usa `server-only`, quindi niente import esplicito.
 */

export const RISK_SIGNALS_VERSION = 1

export interface VoteRiskSignals {
  version: number
  /** HMAC del trusted IP (`null` se non c'è un IP attendibile o manca la chiave). */
  ipHmac: string | null
  ipConfidence: 'high' | 'medium' | 'low' | 'none'
  /** HMAC dell'ASN, se fornito dal chiamante. */
  asnHash: string | null
  /** HMAC dello user-agent, se fornito. */
  uaHash: string | null
  /** Codice paese ISO-3166 alpha-2, sanitizzato e NON hashato. */
  country: string | null
  /** Bucket di sospetto dal punteggio botd (0 = nessuno, 3 = alto). */
  botdBucket: number
  /** Un cookie di fingerprint first-party legacy era presente. */
  legacyFpPresent: boolean
  /** Orologio server, per ordinamento (nessun PII). */
  createdAtMs: number
}

export interface RawSignalsInput {
  ipSignal: ClientIpSignal
  userAgent?: string | null
  asn?: string | null
  country?: string | null
  /** Token/JSON botd grezzo dal client: bucketizzato, mai memorizzato grezzo. */
  botd?: string | null
  legacyFpPresent?: boolean
}

/**
 * Errore di configurazione del keyring dei segnali. Politica **fail-closed**:
 * senza una chiave HMAC valida non si produce alcun fingerprint di
 * correlazione (vedi `signalsFingerprint`).
 */
export class SignalsConfigError extends Error {
  constructor(message = 'SIGNAL_HMAC_KEY/SIGNAL_HMAC_KEY_ID assenti o non validi') {
    super(message)
    this.name = 'SignalsConfigError'
  }
}

/** Soglie di bucketizzazione del punteggio botd normalizzato in [0,1]. */
const SCORE_LOW = 0.25
const SCORE_MEDIUM = 0.5
const SCORE_HIGH = 0.75

/** Normalizza un punteggio (0..1 oppure 0..100) in [0,1]; null se non finito. */
function normalizeScore(score: number): number | null {
  if (!Number.isFinite(score)) return null
  if (score <= 0) return 0
  if (score <= 1) return score
  if (score <= 100) return score / 100
  return 1
}

function bucketFromScore(score: number): number {
  const s = normalizeScore(score)
  if (s === null) return 0
  if (s >= SCORE_HIGH) return 3
  if (s >= SCORE_MEDIUM) return 2
  if (s >= SCORE_LOW) return 1
  return 0
}

/**
 * Mappa un token botd (JSON `{ bot, score, botKind }`, oppure un boolean/numero
 * serializzato) in un bucket 0..3. Non lancia **mai**: input assente, malformato
 * o non riconosciuto → 0.
 */
export function bucketizeBotd(botd: string | null | undefined): number {
  if (typeof botd !== 'string') return 0
  const raw = botd.trim()
  if (!raw) return 0

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 0
  }

  if (typeof parsed === 'boolean') return parsed ? 3 : 0
  if (typeof parsed === 'number') return bucketFromScore(parsed)

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (obj.bot === true) return 3
    if (typeof obj.score === 'number') return bucketFromScore(obj.score)
    if (typeof obj.botKind === 'string' && obj.botKind.trim()) return 2
    return 0
  }

  return 0
}

/** Rimuove spazi e valori vuoti; i campi non-stringa diventano null. */
function normalizeOptional(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Paese ISO-3166 alpha-2: uppercase se valido, altrimenti null. */
function sanitizeCountry(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const country = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(country) ? country : null
}

/** Legge il keyring dei segnali; null se assente o non valido. */
function signalKey(): { key: Buffer; keyId: string } | null {
  const secret = process.env.SIGNAL_HMAC_KEY
  const keyId = process.env.SIGNAL_HMAC_KEY_ID
  if (!secret || !keyId) return null
  const key = Buffer.from(secret, 'base64')
  if (key.length < 32) return null
  return { key, keyId }
}

/**
 * HMAC con domain separation per i campi diversi dall'IP. L'IP usa `hmacIp`
 * (`request-ip.ts`) per restare correlabile con l'`ipHash` già persistito dal
 * percorso di voto legacy.
 */
function hmacField(namespace: string, value: string): string | null {
  const material = signalKey()
  if (!material) return null
  const digest = createHmac('sha256', material.key)
    .update(`${namespace}|${value}`)
    .digest('hex')
  return `${material.keyId}.${digest}`
}

/**
 * Costruisce i segnali tipizzati da input grezzi osservati dal server.
 * L'IP è hashato solo se è un trusted IP (`ip` valorizzato, confidence
 * medium/high); i campi assenti restano `null`.
 */
export function buildVoteRiskSignals(input: RawSignalsInput): VoteRiskSignals {
  const ipSignal = input.ipSignal
  const trustedIp = ipSignal?.ip ?? null

  const userAgent = normalizeOptional(input.userAgent)
  const asn = normalizeOptional(input.asn)

  return {
    version: RISK_SIGNALS_VERSION,
    ipHmac: trustedIp ? hmacIp(trustedIp) : null,
    ipConfidence: ipSignal?.confidence ?? 'none',
    asnHash: asn ? hmacField('asn.v1', asn) : null,
    uaHash: userAgent ? hmacField('ua.v1', userAgent) : null,
    country: sanitizeCountry(input.country),
    botdBucket: bucketizeBotd(input.botd),
    legacyFpPresent: input.legacyFpPresent === true,
    createdAtMs: Date.now(),
  }
}

/**
 * Fingerprint di correlazione deterministico sui campi stabili
 * (`ipHmac`, `asnHash`, `uaHash`, `botdBucket`). Usato per decisioni di
 * correlazione/quarantena: stesso input → stesso output.
 *
 * Politica fail-closed: se `SIGNAL_HMAC_KEY`/`SIGNAL_HMAC_KEY_ID` mancano o la
 * chiave è < 32 byte solleva `SignalsConfigError` invece di restituire un hash
 * non protetto. I chiamanti del percorso shadow devono catturare l'errore e
 * lasciar procedere il voto legacy.
 */
export function signalsFingerprint(signals: VoteRiskSignals): string {
  const material = signalKey()
  if (!material) throw new SignalsConfigError()

  const payload = JSON.stringify([
    RISK_SIGNALS_VERSION,
    signals.ipHmac ?? null,
    signals.asnHash ?? null,
    signals.uaHash ?? null,
    signals.botdBucket ?? 0,
  ])

  const digest = createHmac('sha256', material.key)
    .update(`risk-signals.v1|${payload}`)
    .digest('hex')
  return `${material.keyId}.${digest}`
}
