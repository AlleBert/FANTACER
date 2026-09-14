'use client'

import { useEffect, useRef } from 'react'
import { useVote, type SelectedCompany } from '@/lib/VoteContext'
import { clearStoredVoterId, getStoredVoterId } from '@/lib/vote-persistence'

interface StatusCompany {
  id: string
  name: string
  pallet: 4 | 2 | 1
}

interface StatusResponse {
  voted: boolean
  companies?: StatusCompany[]
  bypassed?: boolean
}

/**
 * Ripristina al mount il voto già registrato oggi, interpellando il server
 * (fonte di verità). Non renderizza nulla.
 */
export function VoteStatusRestore() {
  const { gameUnlock, hydrateVote } = useVote()
  const successRef = useRef(gameUnlock.success)

  useEffect(() => {
    successRef.current = gameUnlock.success
  }, [gameUnlock.success])

  useEffect(() => {
    if (gameUnlock.success) return
    const visitorId = getStoredVoterId()
    if (!visitorId) return

    let cancelled = false

    fetch('/api/vota/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusResponse | null) => {
        if (cancelled || !data) return
        if (data.bypassed) return
        if (data.voted && data.companies && data.companies.length === 3) {
          const restored: SelectedCompany[] = data.companies.map((c) => ({
            company: { id: c.id, name: c.name },
            pallet: c.pallet,
          }))
          hydrateVote(restored)
        } else if (data.voted === false) {
          if (!successRef.current) clearStoredVoterId()
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [gameUnlock.success, hydrateVote])

  return null
}
