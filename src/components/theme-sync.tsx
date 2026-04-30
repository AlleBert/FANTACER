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
          document.documentElement.classList.remove('theme-default', 'theme-cyber', 'theme-fintech')
          document.documentElement.classList.add(data.value)
          console.log('ThemeSync: Applied theme:', data.value)
        } else {
          console.log('ThemeSync: No theme found in settings, using default')
        }
      } catch (err) {
        console.warn('ThemeSync: Exception:', err)
      }
    }
    
    fetchTheme()
  }, [])
  
  return null
}
