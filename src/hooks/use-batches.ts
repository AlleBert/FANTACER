'use client'

import { useEffect, useState } from 'react'

export interface BatchItem {
  name: string
  companyCount: number
  voteCount: number
}

export interface UseBatchesResult {
  batches: BatchItem[]
  activeBatch: string
  loading: boolean
}

/** Carica la lista batch + batch attivo da `/api/admin/batch`. */
export function useBatches(): UseBatchesResult {
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [activeBatch, setActiveBatch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/batch')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setBatches(data.batches || [])
        setActiveBatch(data.activeBatch || '')
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { batches, activeBatch, loading }
}
