'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/sidebar'
import { BottomNav } from '@/components/admin/bottom-nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem('admin_session')
    if (!session) {
      router.push('/admin/login')
      return
    }
    fetch('/api/admin/login', {
      headers: { Authorization: `Bearer ${session}` }
    }).then(res => {
      if (!res.ok) {
        localStorage.removeItem('admin_session')
        router.push('/admin/login')
      } else {
        setAuthorized(true)
      }
    }).catch(() => {
      localStorage.removeItem('admin_session')
      router.push('/admin/login')
    })
  }, [router])

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <AdminSidebar
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`transition-all duration-300 min-h-screen pb-16 md:pb-0 overflow-x-hidden ${
          isSidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[260px]'
        }`}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}