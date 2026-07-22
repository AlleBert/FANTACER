'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/sponsor', label: 'Sponsor', icon: ImageIcon },
  { href: '/admin/dashboard/import', label: 'Import Aziende', icon: Upload },
  { href: '/admin/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem('admin_session')
    window.location.href = '/admin/login'
  }

  return (
    <>
      <aside className={`
        fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border z-40
        flex flex-col transition-all duration-300 ease-out
        ${collapsed ? 'w-[80px]' : 'w-[260px]'}
        -translate-x-full md:translate-x-0
      `}>
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="hidden md:flex absolute -right-3 top-10 h-6 w-6 bg-primary border-2 border-sidebar items-center justify-center rounded-full text-white z-50 hover:scale-110 transition-transform shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo - Always visible */}
        <div className={`p-6 flex items-center justify-center ${collapsed ? 'px-2' : 'px-8'}`}>
          <div className="min-w-[32px] w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">F</span>
          </div>
        </div>

        {/* Expanded title - only when open */}
        {!collapsed && (
          <div className="px-8 pb-4">
            <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight leading-none">
              FANTACER
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">Admin Panel</p>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-primary'}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={`p-4 border-t border-sidebar-border space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
          <ThemeToggle collapsed={collapsed} />
          
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium
              text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}