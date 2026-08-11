'use client'

import { useEffect, useState } from 'react'

export type AdminRole = 'superadmin' | 'admin' | 'viewer'

export function useAdminRole(): AdminRole | null {
  const [role, setRole] = useState<AdminRole | null>(null)

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { role?: AdminRole } | null) => {
        if (data?.role) setRole(data.role)
      })
      .catch(() => {})
  }, [])

  return role
}