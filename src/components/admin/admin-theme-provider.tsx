'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface AdminThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'admin-theme'

/**
 * Storage access must never throw: on mobile browsers with blocked site data
 * (Safari private browsing, "Prevent Cross-Site Tracking", in-app browsers)
 * `localStorage` methods throw SecurityError. An uncaught throw here during
 * render used to bubble to the global error boundary → phantom "500" page
 * while the server was returning 200.
 */
function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'light'
  } catch {
    return 'light'
  }
}

function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage non disponibile: il tema resta in-memory
  }
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    writeTheme(newTheme)
  }

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div 
          className={`min-h-dvh bg-background text-foreground transition-colors duration-300 ${!mounted ? 'opacity-0' : 'opacity-100'}`}
        >
          {children}
        </div>
      </div>
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext)
  if (context === undefined) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider')
  }
  return context
}
