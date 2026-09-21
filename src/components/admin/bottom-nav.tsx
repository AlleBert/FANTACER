'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_ITEMS, isPathActive } from '@/lib/admin-navigation'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      data-testid="admin-bottom-nav"
      aria-label="Navigazione principale"
      className="admin-nav-glass fixed bottom-[var(--safe-bottom)] left-4 right-4 z-50 mx-auto max-w-[34rem] rounded-full p-1.5 md:hidden"
    >
      <div className="flex items-stretch gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = isPathActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={cn(
                'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="admin-nav-label text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
