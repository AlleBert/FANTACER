'use client'

const STORAGE_KEY = 'fantacer_device_id'

function readStoredDeviceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredDeviceId(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId)
  } catch {
    // storage non disponibile: device id resta in-memory per la sessione
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''

  const stored = readStoredDeviceId()

  if (!stored) {
    const deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    writeStoredDeviceId(deviceId)
    return deviceId
  }

  return stored
}