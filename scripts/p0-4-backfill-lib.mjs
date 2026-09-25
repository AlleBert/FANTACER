/**
 * Helper puri di `p0-4-backfill.mjs`.
 *
 * Nessun side effect: importabile da script e test (che lo caricano via
 * subprocess perché ts-jest non importa `.mjs`).
 */

/** Dimensione minima di pagina dopo i retry per timeout. */
export const MIN_BATCH_SIZE = 500

/** True se l'errore è uno statement timeout Postgres (SQLSTATE 57014). */
export function isStatementTimeout(error) {
  if (!error) return false
  return error.code === '57014' || String(error.message ?? '').includes('statement timeout')
}

/** Batch dimezzato per il retry della stessa pagina, mai sotto il minimo. */
export function nextRetryBatchSize(current, min = MIN_BATCH_SIZE) {
  return Math.max(min, Math.floor(current / 2))
}
