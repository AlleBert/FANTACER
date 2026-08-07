'use client'

import { load as loadBotd } from '@fingerprintjs/botd'
import { load as loadFingerprintJS } from '@fingerprintjs/fingerprintjs'

export interface VoteSecurity {
  turnstile_token: string
  botd: string
  visitorId: string
}

export async function getVoteSecurity(token: string): Promise<VoteSecurity> {
  const [botResult, fpResult] = await Promise.all([
    loadBotd().then((botd) => botd.detect()),
    loadFingerprintJS().then((fp) => fp.get()),
  ])

  return {
    turnstile_token: token,
    botd: JSON.stringify(botResult),
    visitorId: fpResult.visitorId,
  }
}