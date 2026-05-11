'use client'

import { useState, useEffect } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { ShieldCheck, X, Loader2 } from 'lucide-react'

interface TurnstileOverlayProps {
  isVisible: boolean
  onClose: () => void
  onSuccess: (token: string) => void
  onError: (error: string) => void
}

export function TurnstileOverlay({ isVisible, onClose, onSuccess, onError }: TurnstileOverlayProps) {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success'>('idle')
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        setStatus('idle')
        setIsClosing(false)
      }, 0)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isVisible])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 300)
  }

  const handleSuccess = (token: string) => {
    setStatus('success')
    // Wait a bit to show the success state
    setTimeout(() => {
      onSuccess(token)
      handleClose()
    }, 1000)
  }

  if (!isVisible && !isClosing) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#0D0C0B]/80 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Card */}
      <div 
        className={`relative w-full max-w-md bg-[#181614] border border-[#2E2A26] rounded-2xl shadow-2xl p-8 transform transition-all duration-300 ${
          isClosing ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'
        }`}
      >
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-[#8C8882] hover:text-[#F0EDE8] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`p-4 rounded-full bg-[#FF6A1A]/10 transition-transform duration-500 ${status === 'success' ? 'rotate-[360deg] scale-110' : ''}`}>
            {status === 'success' ? (
              <ShieldCheck className="h-10 w-10 text-green-500" />
            ) : (
              <ShieldCheck className="h-10 w-10 text-[#FF6A1A]" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#F0EDE8]">
              {status === 'success' ? 'Verifica Completata' : 'Sicurezza Voto'}
            </h2>
            <p className="text-[#8C8882] text-sm max-w-[280px]">
              {status === 'success' ? (
                'Identità confermata! Stiamo registrando il tuo voto...'
              ) : (
                'Per garantire l\'equità del concorso, ti chiediamo una breve verifica anti-bot.'
              )}
            </p>
          </div>

          <div className="relative w-full min-h-[65px] flex items-center justify-center">
            {status === 'idle' && (
              <Turnstile 
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} 
                onSuccess={handleSuccess}
                onExpire={() => setStatus('idle')}
                onError={() => onError('Errore di verifica. Riprova.')}
                options={{ theme: 'dark' }}
              />
            )}
            
            {(status === 'verifying' || status === 'success') && (
              <div className="flex items-center gap-3 text-[#FF6A1A] animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  {status === 'success' ? 'CONFERMATO' : 'ELABORAZIONE...'}
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-[#8C8882] pt-4">
            Protetto da Cloudflare. Nessun dato personale viene memorizzato.
          </p>
        </div>
      </div>
    </div>
  )
}
