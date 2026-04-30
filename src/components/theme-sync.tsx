'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function ThemeSync() {
  const [currentTheme, setCurrentTheme] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const applyTheme = (theme: string) => {
      document.documentElement.classList.remove('theme-default', 'theme-cyber', 'theme-fintech')
      document.documentElement.classList.add(theme)
      setCurrentTheme(theme)
    }
    
    // Fetch initial theme on load
    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'global_theme')
          .single()
        
        if (error) {
          console.warn('ThemeSync: Error fetching theme:', error.message)
          return
        }
        
        if (data && data.value) {
          applyTheme(data.value)
          console.log('ThemeSync: Applied theme:', data.value)
        }
      } catch (err) {
        console.warn('ThemeSync: Exception:', err)
      }
    }
    
    fetchTheme()
    
    // Listen for realtime theme changes from Admin
    const channel = supabase.channel('global_theme_sync')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'settings', 
        filter: "key=eq.global_theme" 
      }, (payload) => {
        if (payload.new && payload.new.value) {
          applyTheme(payload.new.value)
          console.log('ThemeSync: Realtime theme updated:', payload.new.value)
        }
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  return null
}
