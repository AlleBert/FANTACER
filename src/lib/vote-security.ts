'use client'

import { load as loadBotd } from '@fingerprintjs/botd'
import { load as loadFingerprintJS } from '@fingerprintjs/fingerprintjs'

export interface VoteSecurity {
  turnstile_token: string
  botd: string
  visitorId: string
}

export async function getVoteSecurity(token: string): Promise<VoteSecurity> {
  const [botd, fpResult] = await Promise.all([
    loadBotd()
      .then((botd) => botd.detect())
      .then((result) => JSON.stringify(result))
      .catch(() => ''),
    loadFingerprintJS().then((fp) => fp.get()),
  ])

  return {
    turnstile_token: token,
    botd,
    visitorId: fpResult.visitorId,
  }
}