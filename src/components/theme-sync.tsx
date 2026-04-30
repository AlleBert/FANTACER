'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function ThemeSync() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Fetch initial theme on load
    const fetchTheme = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'global_theme')
        .single()
        
      if (data && data.value) {
        document.documentElement.classList.remove('theme-default', 'theme-cyber', 'theme-fintech')
        document.documentElement.classList.add(data.value)
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
        document.documentElement.classList.remove('theme-default', 'theme-cyber', 'theme-fintech')
        document.documentElement.classList.add(payload.new.value)
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  
  return null
}
