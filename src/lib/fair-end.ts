export type FairEndPhase = 'off' | 'waiting' | 'final'

export interface FairEndCeremony { '1': string; '2': string; '3': string }
export interface FairEndConfig {
  revealTime: string
  revealAt: string | null
  ceremony: FairEndCeremony
}

export const DEFAULT_FAIR_END_CONFIG: FairEndConfig = {
  revealTime: '12:30',
  revealAt: null,
  ceremony: { '1': '14:00', '2': '13:45', '3': '13:30' },
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && TIME_RE.test(v)
}

export function parseFairEndConfig(value: string | null | undefined): FairEndConfig {
  if (!value) return { ...DEFAULT_FAIR_END_CONFIG }
  try {
    const raw = JSON.parse(value) as Record<string, unknown>
    const revealTime = isValidTime(raw.revealTime) ? raw.revealTime : DEFAULT_FAIR_END_CONFIG.revealTime
    const revealAt = typeof raw.revealAt === 'string' ? raw.revealAt : null
    const c = (raw.ceremony ?? {}) as Record<string, unknown>
    const ceremony: FairEndCeremony = {
      '1': isValidTime(c['1']) ? (c['1'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['1'],
      '2': isValidTime(c['2']) ? (c['2'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['2'],
      '3': isValidTime(c['3']) ? (c['3'] as string) : DEFAULT_FAIR_END_CONFIG.ceremony['3'],
    }
    return { revealTime, revealAt, ceremony }
  } catch {
    return { ...DEFAULT_FAIR_END_CONFIG }
  }
}

/** Offset (minuti) di Europe/Rome per un dato istante, senza dipendenze. */
function romeOffsetMinutes(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Rome', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return (asUTC - date.getTime()) / 60000
}

/** Istante ISO di "oggi (Europe/Rome) alle HH:MM". */
export function resolveRevealAt(revealTime: string, now: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const guess = new Date(`${day}T${revealTime}:00Z`)
  return new Date(guess.getTime() - romeOffsetMinutes(guess) * 60000).toISOString()
}

export function computeFairEndPhase(enabled: boolean, revealAt: string | null, now: Date): FairEndPhase {
  if (!enabled) return 'off'
  if (!revealAt) return 'waiting'
  return now.getTime() >= Date.parse(revealAt) ? 'final' : 'waiting'
}
