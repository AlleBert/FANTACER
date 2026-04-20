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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md border-border shadow-xl bg-card">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Cookie className="h-5 w-5 text-accent" />
          </div>
          <CardTitle className="text-xl">Cookie & Privacy</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto h-8 w-8 hover:bg-secondary"
            onClick={() => setShowBanner(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Questo sito utilizza cookie necessari per il funzionamento. 
            Previo tuo consenso, utilizziamo anche cookie analitici per migliorare l&apos;esperienza.
            I dati raccolti sono trattati secondo la normativa italiana (D.Lgs. 196/2003 e GDPR).
          </p>
          
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => handleAccept(false)}
              className="flex-1 border-border hover:bg-secondary hover:text-foreground"
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