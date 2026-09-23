import { createAdminClient } from './supabase/admin'
import { computeFairEndPhase, parseFairEndConfig, type FairEndPhase } from './fair-end'

/**
 * Flag di sito lette lato server.
 *
 * Cache in-memory breve: la propagazione "istantanea" ai client è realtime
 * (`site_settings`), questa è solo la lettura server-side usata come gate.
 * Il trade-off è una finestra di ~3s in cui un cambio Admin non è ancora
 * applicato dal server; accettabile e allineata alla cache del proxy.
 */
const ANTIBOT_TTL_MS = 3_000

interface FlagCache {
  value: boolean
  expiresAt: number
}

let antibotCache: FlagCache | null = null

/**
 * `true` quando l'anti-bot è attivo (voto sospeso, classifica live nascosta).
 * Fail-open: su errore di lettura NON blocca il voto (stessa filosofia della
 * cache `coming_soon` del proxy).
 */
export async function getAntibotEnabled(): Promise<boolean> {
  const now = Date.now()
  if (antibotCache && antibotCache.expiresAt > now) return antibotCache.value

  let value = false
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('site_settings')
      .select('value')
      .eq('key', 'antibot_enabled')
      .single()
    value = data?.value === 'true'
  } catch {
    value = false
  }

  antibotCache = { value, expiresAt: now + ANTIBOT_TTL_MS }
  return value
}

export interface FairEndState {
  enabled: boolean
  phase: FairEndPhase
  revealAt: string | null
  ceremony: ReturnType<typeof parseFairEndConfig>['ceremony']
}

let fairEndCache: { value: FairEndState; expiresAt: number } | null = null

/**
 * Stato FINE FIERA letto server-side. Cache 3s (come antibot). Fail-open: off.
 */
export async function getFairEndState(): Promise<FairEndState> {
  const now = Date.now()
  if (fairEndCache && fairEndCache.expiresAt > now) return fairEndCache.value

  let enabled = false
  let config = parseFairEndConfig(null)
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('site_settings')
      .select('key, value')
      .in('key', ['fair_end_enabled', 'fair_end_config'])
    for (const row of data ?? []) {
      if (row.key === 'fair_end_enabled') enabled = row.value === 'true'
      if (row.key === 'fair_end_config') config = parseFairEndConfig(row.value)
    }
  } catch {
    enabled = false
    config = parseFairEndConfig(null)
  }

  const value: FairEndState = {
    enabled,
    phase: computeFairEndPhase(enabled, config.revealAt, new Date(now)),
    revealAt: config.revealAt,
    ceremony: config.ceremony,
  }
  fairEndCache = { value, expiresAt: now + 3_000 }
  return value
}
