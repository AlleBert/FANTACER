'use client'

import { useEffect, useState } from 'react'
import { useRealtime } from '@/lib/RealtimeContext'
import { computeFairEndPhase, type FairEndPhase } from '@/lib/fair-end'

/** Fase FINE FIERA corrente; si aggiorna ogni secondo solo in attesa del reveal. */
export function useFairEndPhase(): FairEndPhase {
  const { fairEndEnabled, fairEndRevealAt } = useRealtime()
  const [now, setNow] = useState(() => Date.now())

  const phase = computeFairEndPhase(fairEndEnabled, fairEndRevealAt, new Date(now))
  const ticking = phase === 'waiting'

  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  return phase
}
