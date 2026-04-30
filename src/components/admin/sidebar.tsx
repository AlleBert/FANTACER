'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Upload, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/import', label: 'Import Aziende', icon: Upload },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('admin_session')
    window.location.href = '/admin/login'
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50 text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-40
        flex flex-col transition-all duration-300 shadow-sm
        ${collapsed ? 'w-[80px]' : 'w-[260px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="hidden md:flex absolute -right-3 top-10 h-6 w-6 bg-primary border-2 border-sidebar items-center justify-center rounded-full text-white z-50 hover:scale-110 transition-transform shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        <div className={`p-8 ${collapsed ? 'px-6' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="min-w-[32px] w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight leading-none">
                  FANTACER
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-primary'}`} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className={`p-4 border-t border-sidebar-border space-y-2 ${collapsed ? 'px-4' : ''}`}>
          <ThemeToggle collapsed={collapsed} />
          
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium
              text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200
              ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>
    </>
  )
}