/**
 * P0-4 / C08 — Correlazione di una **nuova sessione** con principal che hanno
 * già votato nello stesso `vote_day` (§4.2 del piano).
 *
 * **Scope C08 (decisione only).** Questo modulo è una **funzione pura**: data la
 * firma dei segnali pseudonimizzati della sessione corrente e l'insieme dei
 * principal che hanno già votato oggi, decide `accept | stepup | quarantine`.
 * La **scrittura** dello stato `quarantined` sul voto, i `risk findings`
 * persistiti, il trigger sui totali e la RPC admin sono **C11** (migration
 * `vote_quarantine`): qui non si tocca il DB e non si introduce alcun oracle
 * nelle risposte pubbliche.
 *
 * Regole (soglie iniziali prudenti e reversibili):
 * - nessun principal pregresso → `accept`;
 * - `signalsFingerprint` identico, oppure `legacyFingerprint` residuo identico,
 *   oppure ≥2 componenti stabili condivise → `quarantine` (correlazione forte);
 * - esattamente 1 componente condivisa → `stepup` (sospetto ambiguo);
 * - nessuna componente condivisa → `accept`.
 *
 * I campi `null` non contano mai come sovrapposizione. Il match è calcolato sul
 * **massimo** overlap tra i principal pregressi.
 */

export const CORRELATION_VERSION = 1

export type VoteRiskDecision = 'accept' | 'stepup' | 'quarantine'

/** Firma dei segnali pseudonimizzati usata per la correlazione. */
export interface CorrelationSignals {
  /** HMAC deterministico dei segnali stabili (vedi `signalsFingerprint`). */
  signalsFingerprint: string
  ipHmac: string | null
  asnHash: string | null
  uaHash: string | null
  /** Fingerprint legacy first-party residuo (`v1:<uuid>`), se noto. */
  legacyFingerprint: string | null
}

export interface AssessNewSessionRiskInput {
  signals: CorrelationSignals
  priorPrincipalsWithSameDayVote: CorrelationSignals[]
}

/** Componenti stabili considerate per l'overlap parziale (esclusi i fingerprint). */
function overlappingComponents(a: CorrelationSignals, b: CorrelationSignals): number {
  let shared = 0
  if (a.ipHmac && b.ipHmac && a.ipHmac === b.ipHmac) shared++
  if (a.asnHash && b.asnHash && a.asnHash === b.asnHash) shared++
  if (a.uaHash && b.uaHash && a.uaHash === b.uaHash) shared++
  return shared
}

function isStrongMatch(current: CorrelationSignals, prior: CorrelationSignals): boolean {
  if (current.signalsFingerprint === prior.signalsFingerprint) return true
  if (
    current.legacyFingerprint &&
    prior.legacyFingerprint &&
    current.legacyFingerprint === prior.legacyFingerprint
  ) {
    return true
  }
  return overlappingComponents(current, prior) >= 2
}

/**
 * Decide l'esito di rischio di una sessione nuova. Pura e deterministica:
 * stesso input → stesso esito.
 */
export function assessNewSessionRisk(input: AssessNewSessionRiskInput): VoteRiskDecision {
  const { signals, priorPrincipalsWithSameDayVote } = input
  if (priorPrincipalsWithSameDayVote.length === 0) return 'accept'

  let maxOverlap = 0
  for (const prior of priorPrincipalsWithSameDayVote) {
    if (isStrongMatch(signals, prior)) return 'quarantine'
    const shared = overlappingComponents(signals, prior)
    if (shared > maxOverlap) maxOverlap = shared
  }

  return maxOverlap >= 1 ? 'stepup' : 'accept'
}
