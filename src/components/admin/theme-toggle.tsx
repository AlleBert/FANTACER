'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminTheme } from './admin-theme-provider'

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useAdminTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`w-full justify-start gap-3 h-11 px-4 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all ${collapsed ? 'justify-center px-0' : ''}`}
    >
      {theme === 'light' ? (
        <>
          <Moon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Dark Mode</span>}
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Light Mode</span>}
        </>
      )}
    </Button>
  )
}
