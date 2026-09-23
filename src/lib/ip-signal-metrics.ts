import type { ClientIpSignal } from '@/lib/request-ip'
import { isTrusted } from '@/lib/request-ip'

interface Snapshot {
  total: number
  noTrustedIp: number
  byConfidence: Record<'high' | 'medium' | 'low' | 'none', number>
}

/**
 * Misura dell'assenza di IP affidabile.
 *
 * Serverless: i contatori in-memory sono **per-istanza** e non aggregabili tra
 * invocazioni/lambda diverse. La fonte di verità in produzione è il **log
 * strutturato** emesso a ogni segnale non attendibile (aggregabile dai log
 * Vercel). `getIpSignalSnapshot()` è utile solo per test e debug locale.
 */
let counters: Snapshot = {
  total: 0,
  noTrustedIp: 0,
  byConfidence: { high: 0, medium: 0, low: 0, none: 0 },
}

export function resetIpSignalMetrics(): void {
  counters = { total: 0, noTrustedIp: 0, byConfidence: { high: 0, medium: 0, low: 0, none: 0 } }
}

export function getIpSignalSnapshot(): Snapshot {
  return {
    total: counters.total,
    noTrustedIp: counters.noTrustedIp,
    byConfidence: { ...counters.byConfidence },
  }
}

/**
 * Misura l'assenza di IP affidabile senza registrare valori (né `ip` né
 * `detectedIp`). Log strutturato + contatore per-istanza.
 */
export function recordIpSignal(signal: ClientIpSignal): void {
  counters.total += 1
  counters.byConfidence[signal.confidence] += 1
  if (!isTrusted(signal)) {
    counters.noTrustedIp += 1
    console.warn('[ip] no trusted client ip', {
      source: signal.source,
      confidence: signal.confidence,
      hasDetectedIp: signal.detectedIp !== null,
    })
  }
}
