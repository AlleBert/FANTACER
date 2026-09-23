'use client'

import { useEffect, useState } from 'react'
import { useRealtime } from '@/lib/RealtimeContext'
import { computeFairEndPhase, type FairEndPhase } from '@/lib/fair-end'

/** Fase FINE FIERA corrente; si aggiorna ogni secondo mentre il flag è attivo. */
export function useFairEndPhase(): FairEndPhase {
  const { fairEndEnabled, fairEndRevealAt } = useRealtime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!fairEndEnabled) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [fairEndEnabled])

  return computeFairEndPhase(fairEndEnabled, fairEndRevealAt, new Date(now))
}
