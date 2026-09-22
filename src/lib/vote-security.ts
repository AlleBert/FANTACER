'use client'

import { load as loadBotd } from '@fingerprintjs/botd'
import { load as loadFingerprintJS } from '@fingerprintjs/fingerprintjs'
import { ensureVoterId } from './vote-client-identity'

export interface VoteSecurity {
  turnstile_token: string
  botd: string
  /** FingerprintJS: solo diagnostica, NON è la chiave di voto. */
  visitorId: string
  /** UUID first-party: identità ordinaria usata per la dedup giornaliera. */
  voterId: string
}

/**
 * botd è solo audit lato server (non gate del voto): se impiega troppo (CPU
 * mobile, rete lenta) non deve ritardare l'invio. Oltre il timeout si invia
 * stringa vuota e il voto procede.
 */
const BOTD_TIMEOUT_MS = 1500

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

/**
 * visitorId FingerprintJS memoizzato. `fp.get()` è CPU-heavy (~1-2s su device
 * lenti): calcolarlo al primo input utile evita di sommarlo al submit. In caso
 * di errore il promise viene invalidato così un retry può ritentare.
 */
let visitorIdPromise: Promise<string> | null = null

export function getVisitorId(): Promise<string> {
  if (!visitorIdPromise) {
    const promise = loadFingerprintJS()
      .then((fp) => fp.get())
      .then((result) => result.visitorId)

    promise.catch(() => {
      if (visitorIdPromise === promise) visitorIdPromise = null
    })

    visitorIdPromise = promise
  }

  return visitorIdPromise
}

export async function getVoteSecurity(token: string): Promise<VoteSecurity> {
  const botd = withTimeout(
    loadBotd()
      .then((botd) => botd.detect())
      .then((result) => JSON.stringify(result)),
    BOTD_TIMEOUT_MS,
    '',
  )

  const [botdResult, visitorId, voterId] = await Promise.all([
    botd,
    getVisitorId(),
    ensureVoterId(),
  ])

  return {
    turnstile_token: token,
    botd: botdResult,
    visitorId,
    voterId,
  }
}
