'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface AdminThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined)

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('admin-theme') as Theme) || 'light'
    }
    return 'light'
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin-theme', newTheme)
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
