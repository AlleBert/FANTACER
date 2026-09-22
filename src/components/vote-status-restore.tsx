'use client'

import { useEffect, useRef } from 'react'
import { useVote, type SelectedCompany } from '@/lib/VoteContext'
import { setStoredVoterId } from '@/lib/vote-persistence'
import { ensureVoterId, isNewVoterIdentity } from '@/lib/vote-client-identity'

interface StatusCompany {
  id: string
  name: string
  pallet: 4 | 2 | 1
}

interface StatusResponse {
  voted: boolean
  companies?: StatusCompany[]
  bypassed?: boolean
  voterId?: string
}

/**
 * Ripristina al mount il voto già registrato oggi, interpellando il server
 * (fonte di verità). L'identità è l'UUID first-party, non il FingerprintJS.
 * Non renderizza nulla.
 */
export function VoteStatusRestore() {
  const { gameUnlock, hydrateVote } = useVote()
  const successRef = useRef(gameUnlock.success)

  useEffect(() => {
    successRef.current = gameUnlock.success
  }, [gameUnlock.success])

  useEffect(() => {
    if (gameUnlock.success) return
    let cancelled = false

    ;(async () => {
      const voterId = await ensureVoterId()
      if (cancelled) return
      // Identità appena generata: non può avere voti precedenti, evita la call.
      if (isNewVoterIdentity()) return

      const res = await fetch('/api/vota/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId }),
      })
      if (cancelled) return
      if (!res.ok) return
      const data = (await res.json()) as StatusResponse | null
      if (cancelled || !data) return

      // Riallinea l'identità persistita con quella risolta dal server.
      if (data.voterId && data.voterId !== voterId) setStoredVoterId(data.voterId)

      if (data.bypassed) return
      if (data.voted && data.companies && data.companies.length === 3) {
        const restored: SelectedCompany[] = data.companies.map((c) => ({
          company: { id: c.id, name: c.name },
          pallet: c.pallet,
        }))
        hydrateVote(restored)
      }
      // voted:false: nessuna azione. L'identità NON va cancellata (è stabile
      // per browser e serve ai voti futuri).
    })().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [gameUnlock.success, hydrateVote])

  return null
}
