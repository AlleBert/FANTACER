import { isIP } from 'node:net'
import { createHmac } from 'node:crypto'

/**
 * Estrazione IP attendibile — unica fonte server-side.
 *
 * Modello di fiducia (vedi `docs/request-ip.md`):
 * - `cf-connecting-ip` + `cf-ray` → **euristica** di provenienza Cloudflare
 *   (Cloudflare sovrascrive entrambi). Non è una prova crittografica: `cf-ray`
 *   è solo un'euristica. `confidence: 'medium'`, mai `high`.
 * - `cf-connecting-ip` senza `cf-ray` → segnale rilevato ma non attendibile
 *   (`detectedIp` valorizzato, `ip` null).
 * - `x-real-ip` (Vercel) → segnale, non attendibile.
 * - `x-forwarded-for` è client-controllabile: usato SOLO fuori da produzione.
 * - Nessuna evidenza → `detectedIp` null, `ip` null. Mai un valore condiviso.
 *
 * Distinzione chiave: `detectedIp` è ciò che è stato osservato (osservabilità),
 * `ip` è l'unico valore usabile per decisioni di sicurezza (medium/high).
 */

const V4_MAPPED_DOTTED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i
const V4_WITH_PORT = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/

function canonicalizeV4(value: string): string | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return nums.join('.')
}

function canonicalizeV6(value: string): string {
  const v = value.toLowerCase()
  const hasElision = v.includes('::')
  const [head, tail] = hasElision ? v.split('::') : [v, '']
  const headGroups = head ? head.split(':') : []
  const tailGroups = hasElision && tail ? tail.split(':') : []
  const missing = 8 - headGroups.length - tailGroups.length
  const groups = hasElision
    ? [...headGroups, ...Array(Math.max(missing, 0)).fill('0'), ...tailGroups]
    : headGroups
  if (groups.length !== 8) return v

  const hex = groups.map((g) => g.padStart(4, '0'))

  // IPv4-mapped in forma esadecimale (::ffff:c0a8:010a) → IPv4.
  if (hex.slice(0, 5).every((g) => g === '0000') && hex[5] === 'ffff') {
    const byte = (i: number, hi: boolean) =>
      parseInt(hi ? hex[i].slice(0, 2) : hex[i].slice(2), 16)
    return [byte(6, true), byte(6, false), byte(7, true), byte(7, false)].join('.')
  }

  const norm = hex.map((g) => g.replace(/^0+(?=.)/, ''))

  let bestStart = -1
  let bestLen = 0
  for (let i = 0; i < 8; ) {
    if (norm[i] !== '0') {
      i++
      continue
    }
    let j = i
    while (j < 8 && norm[j] === '0') j++
    if (j - i > bestLen) {
      bestLen = j - i
      bestStart = i
    }
    i = j
  }
  if (bestLen < 2) return norm.join(':')
  return `${norm.slice(0, bestStart).join(':')}::${norm.slice(bestStart + bestLen).join(':')}`
}

/**
 * Canonicalizza un IP IPv4/IPv6; `null` se non valido.
 * IPv6 canonicalizzato (compressione, lowercase, mapped→IPv4), porte/bracket/zone rimosse.
 */
export function canonicalizeIp(raw: string | null | undefined): string | null {
  if (raw == null) return null
  let value = raw.trim()
  if (!value) return null

  const bracketed = value.match(/^\[(.+)\](?::\d+)?$/)
  if (bracketed) value = bracketed[1]

  // Zone id IPv6 (`fe80::1%eth0`): ambiguo e non instradabile → rifiutato.
  if (value.includes('%')) return null

  if (V4_WITH_PORT.test(value)) value = value.slice(0, value.indexOf(':'))

  const mapped = value.match(V4_MAPPED_DOTTED)
  if (mapped) value = mapped[1]

  const version = isIP(value)
  if (version === 4) return canonicalizeV4(value)
  if (version === 6) return canonicalizeV6(value)
  return null
}

export type IpConfidence = 'high' | 'medium' | 'low' | 'none'
export type IpSource = 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for' | 'none'

export interface ClientIpSignal {
  /** IP utilizzabile per decisioni di sicurezza: valorizzato solo se medium/high. */
  ip: string | null
  /** Valore canonicalizzato osservato, anche quando non attendibile (osservabilità). */
  detectedIp: string | null
  source: IpSource
  confidence: IpConfidence
}

export interface IpEvidence {
  cfConnectingIp?: string | null
  cfRay?: string | null
  realIp?: string | null
  forwardedFor?: string | null
  nodeEnv?: string
}

function firstForwarded(value?: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]
  return first ? first.trim() : null
}

/** Funzione pura: testabile senza Request. */
export function resolveIpSignal(e: IpEvidence): ClientIpSignal {
  const cf = canonicalizeIp(e.cfConnectingIp)
  if (cf && e.cfRay) {
    // cf-ray = euristica Cloudflare, non prova: `ip` è attendibile solo come
    // segnale debole (medium). Mai `high` senza prova forte condivisa.
    return { ip: cf, detectedIp: cf, source: 'cf-connecting-ip', confidence: 'medium' }
  }
  if (cf) {
    return { ip: null, detectedIp: cf, source: 'cf-connecting-ip', confidence: 'low' }
  }

  const real = canonicalizeIp(e.realIp)
  if (real) {
    return { ip: null, detectedIp: real, source: 'x-real-ip', confidence: 'low' }
  }

  // Solo in locale/development: mai fidarsi di XFF in produzione.
  if (e.nodeEnv && e.nodeEnv !== 'production') {
    const xff = canonicalizeIp(firstForwarded(e.forwardedFor))
    if (xff) {
      return { ip: null, detectedIp: xff, source: 'x-forwarded-for', confidence: 'low' }
    }
  }

  return { ip: null, detectedIp: null, source: 'none', confidence: 'none' }
}

/** Unico punto di lettura degli header IP in tutta l'app. */
export function getTrustedClientIp(request: Request): ClientIpSignal {
  return resolveIpSignal({
    cfConnectingIp: request.headers.get('cf-connecting-ip'),
    cfRay: request.headers.get('cf-ray'),
    realIp: request.headers.get('x-real-ip'),
    forwardedFor: request.headers.get('x-forwarded-for'),
    nodeEnv: process.env.NODE_ENV,
  })
}

export function isTrusted(signal: ClientIpSignal): boolean {
  return signal.confidence === 'high' || signal.confidence === 'medium'
}

/**
 * Pseudonimizzazione server-side (HMAC-SHA256). L'IP grezzo non deve mai
 * finire in log o persistenza. Richiede `SIGNAL_HMAC_KEY` (base64, ≥32 byte
 * decodificati) e `SIGNAL_HMAC_KEY_ID` (obbligatorio per la rotazione).
 * Altrimenti ritorna `null` (fail-safe: nessun segnale invece di un hash
 * non protetto o non versionato).
 */
export function hmacIp(ip: string): string | null {
  const secret = process.env.SIGNAL_HMAC_KEY
  const keyId = process.env.SIGNAL_HMAC_KEY_ID
  if (!secret || !keyId) return null

  const key = Buffer.from(secret, 'base64')
  if (key.length < 32) return null

  const digest = createHmac('sha256', key).update(ip).digest('hex')
  return `${keyId}.${digest}`
}
