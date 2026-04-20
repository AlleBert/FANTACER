'use client'

const STORAGE_KEY = 'fantacer_device_id'
const VOTE_TOKEN_KEY = 'fantacer_vote_token'
const LAST_VOTE_DATE_KEY = 'fantacer_last_vote'

export interface DeviceFingerprint {
  id: string
  createdAt: string
  lastUsed: string
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''

  let deviceId = localStorage.getItem(STORAGE_KEY)
  
  if (!deviceId) {
    deviceId = generateId()
    localStorage.setItem(STORAGE_KEY, deviceId)
  }

  // Update last used
  const data: DeviceFingerprint = {
    id: deviceId,
    createdAt: localStorage.getItem(`${STORAGE_KEY}_created`) || new Date().toISOString(),
    lastUsed: new Date().toISOString()
  }
  localStorage.setItem(STORAGE_KEY, data.id)
  localStorage.setItem(`${STORAGE_KEY}_created`, data.createdAt)

  return deviceId
}

export function getLastVoteDate(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_VOTE_DATE_KEY)
}

export function canVoteToday(): boolean {
  if (typeof window === 'undefined') return false
  
  const lastVote = localStorage.getItem(LAST_VOTE_DATE_KEY)
  if (!lastVote) return true

  const today = new Date().toISOString().split('T')[0]
  return lastVote !== today
}

export function markVotedToday(): void {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(LAST_VOTE_DATE_KEY, today)
}

export function hasAlreadyVoted(): boolean {
  return !canVoteToday()
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Canvas fingerprint for additional device identification
export async function getCanvasFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve('')
      return
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve('')
      return
    }

    canvas.width = 200
    canvas.height = 50

    // Draw various elements to get unique fingerprint
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('FANTACER', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('FANTACER', 4, 17)

    const dataUrl = canvas.toDataURL()
    const hash = simpleHash(dataUrl)
    resolve(hash)
  })
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

export function getCombinedFingerprint(): Promise<string> {
  return new Promise(async (resolve) => {
    const deviceId = getOrCreateDeviceId()
    const canvasFp = await getCanvasFingerprint()
    const screenRes = `${window.screen.width}x${window.screen.height}`
    const userAgent = navigator.userAgent.substring(0, 50)
    
    const combined = simpleHash(`${deviceId}-${canvasFp}-${screenRes}-${userAgent}`)
    resolve(combined)
  })
}