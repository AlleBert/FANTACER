'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function ThemeSync() {
  const [currentTheme, setCurrentTheme] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('ThemeSync: initializing...')
  
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const applyTheme = (theme: string) => {
      document.documentElement.classList.remove('theme-default', 'theme-cyber', 'theme-fintech')
      document.documentElement.classList.add(theme)
      setCurrentTheme(theme)
      setDebugInfo(`Applied theme: ${theme}`)
      console.log('ThemeSync: Applied theme:', theme)
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
          setDebugInfo(`Fetch error: ${error.message}`)
          console.warn('ThemeSync: Error fetching theme:', error.message)
          return
        }
        
        if (data && data.value) {
          applyTheme(data.value)
        } else {
          setDebugInfo('No theme in DB, using default')
          console.log('ThemeSync: No theme found in settings, using default')
        }
      } catch (err: any) {
        setDebugInfo(`Exception: ${err.message}`)
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
      }, (payload: any) => {
        console.log('ThemeSync: Received realtime payload:', payload)
        if (payload.new && payload.new.value) {
          applyTheme(payload.new.value)
        }
      })
      .subscribe((status: string) => {
        setDebugInfo(`Channel status: ${status}`)
        console.log('ThemeSync: Channel subscription status:', status)
      })
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  // Debug: render nothing, but log info
  return null
}
