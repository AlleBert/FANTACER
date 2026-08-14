'use client'

import { useState } from 'react'
import { AdminSidebar } from '@/components/admin/sidebar'
import { BottomNav } from '@/components/admin/bottom-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-dvh bg-background transition-colors duration-300">
      <AdminSidebar
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`transition-all duration-300 min-h-dvh pb-16 md:pb-0 overflow-x-hidden ${
          isSidebarCollapsed ? 'md:ml-[var(--admin-sidebar-width-collapsed)]' : 'md:ml-[var(--admin-sidebar-width)]'
        }`}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}