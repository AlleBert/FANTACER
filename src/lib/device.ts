'use client'

const STORAGE_KEY = 'fantacer_device_id'

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''

  let deviceId = localStorage.getItem(STORAGE_KEY)

  if (!deviceId) {
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    localStorage.setItem(STORAGE_KEY, deviceId)
  }

  return deviceId
}