'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Vote, Upload, Settings, Image as ImageIcon, type LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard/panoramica', label: 'Panoramica', icon: LayoutDashboard },
  { href: '/admin/dashboard/sponsor', label: 'Sponsor', icon: ImageIcon },
  { href: '/admin/dashboard/aziende', label: 'Aziende', icon: Building2 },
  { href: '/admin/dashboard/voti', label: 'Voti', icon: Vote },
  { href: '/admin/dashboard/import', label: 'Import', icon: Upload },
  { href: '/admin/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-pb md:hidden" role="tablist" aria-label="Navigazione principale">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[64px] ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
