import type { AnalyticsSummary } from './admin-analytics'

export type AnalyticsSummaryRpc = Omit<AnalyticsSummary, 'onlineUsers'>

/** Normalizza il jsonb della RPC: numeri sempre definiti, serie sempre array. */
export function mapSummaryRpc(raw: unknown): AnalyticsSummaryRpc {
  const r = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
  return {
    totalVotes: num(r.totalVotes),
    uniqueVoters: num(r.uniqueVoters),
    todayVotes: num(r.todayVotes),
    yesterdayVotes: num(r.yesterdayVotes),
    activeNow: num(r.activeNow),
    dailyStats: Array.isArray(r.dailyStats) ? (r.dailyStats as AnalyticsSummaryRpc['dailyStats']) : [],
    hourlyByDay:
      r.hourlyByDay && typeof r.hourlyByDay === 'object'
        ? (r.hourlyByDay as AnalyticsSummaryRpc['hourlyByDay'])
        : {},
  }
}
