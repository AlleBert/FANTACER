'use client'

import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { hasConsented, getAnalyticsConsent, setConsent } from '@/lib/cookie'

interface GDPRBannerProps {
  onAccept: (analytics: boolean) => void
}

export function GDPRBanner({ onAccept }: GDPRBannerProps) {
  const [showBanner, setShowBanner] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (hasConsented()) {
      const analytics = getAnalyticsConsent()
      onAccept(analytics)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowBanner(false)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowBanner(true)
    }
  }, [onAccept])

  const handleAccept = (analytics: boolean) => {
    const consentData = {
      necessary: true,
      analytics,
      timestamp: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('fantacer_consent', JSON.stringify(consentData))
      setConsent(consentData)
    }
    setShowBanner(false)
    onAccept(analytics)
  }

  if (showBanner === null) return null
  if (!showBanner) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Cookie className="h-5 w-5" />
          <CardTitle>Cookie & Privacy</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto h-8 w-8"
            onClick={() => setShowBanner(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Utilizziamo cookie necessari per il funzionamento. Per supportarci, puoi 
            accettare anche cookie analitici che ci aiutano a migliorare il servizio.
            I dati raccolti sono vendibili solo se accetti.
          </p>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleAccept(false)}
              className="flex-1"
            >
              Solo necessari
            </Button>
            <Button 
              onClick={() => handleAccept(true)}
              className="flex-1"
            >
              Accetta tutto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
