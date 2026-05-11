'use client'

import { useState, useEffect } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { Star, X, Loader2 } from 'lucide-react'

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
    setTimeout(() => {
      onSuccess(token)
      handleClose()
    }, 800)
  }

  if (!isVisible && !isClosing) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      } ${!isVisible && !isClosing ? 'pointer-events-none' : 'pointer-events-auto'}`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#8000ff]/10 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Card */}
      <div 
        className={`relative w-full max-w-sm bg-white border-2 border-[#8000ff] rounded-3xl shadow-[0_8px_0_#231f20] p-6 transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 text-[#8000ff] hover:bg-[#8000ff]/10 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className={`
            relative p-3 rounded-full transition-all duration-500
            ${status === 'success' ? 'bg-[#fccb27]' : 'bg-[#8000ff]/10'}
          `}>
            {status === 'success' ? (
              <Star className="h-8 w-8 fill-[#231f20] stroke-[#231f20] stroke-2" />
            ) : (
              <Star className="h-8 w-8 fill-[#8000ff] stroke-[#8000ff] stroke-2" />
            )}
          </div>

          {/* Text */}
          <div className="space-y-1">
            <h2 className="text-lg font-black text-[#8000ff] uppercase tracking-tight">
              {status === 'success' ? 'Tutto pronto!' : 'Verifica'}
            </h2>
            <p className="text-sm text-[#231f20]/70 max-w-[260px]">
              {status === 'success' ? (
                'Il tuo voto è in arrivo!'
              ) : (
                'Conferma di essere una persona reale'
              )}
            </p>
          </div>

          {/* Turnstile Container */}
          <div className="relative w-full min-h-[65px] flex items-center justify-center">
            {status === 'idle' && (
              <Turnstile 
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''} 
                onSuccess={handleSuccess}
                onExpire={() => setStatus('idle')}
                onError={() => onError('Errore di verifica. Riprova.')}
                options={{ theme: 'light' }}
              />
            )}
            
            {(status === 'verifying' || status === 'success') && (
              <div className="flex items-center gap-2 text-[#8000ff]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-bold uppercase tracking-wide">
                  {status === 'success' ? 'OK!' : 'Verifica...'}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-[#231f20]/40 pt-2">
            Nessun dato personale memorizzato
          </p>
        </div>
      </div>
    </div>
  )
}