'use client'

import { AdminThemeProvider } from '@/components/admin/admin-theme-provider'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminThemeProvider>
      {children}
    </AdminThemeProvider>
  )
}