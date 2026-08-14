'use client'

import { useState, useEffect } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { Star, X, Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/LocaleContext'

interface TurnstileOverlayProps {
  isVisible: boolean
  onClose: () => void
  onSuccess: (token: string) => void
  onError: (error: string) => void
}

export function TurnstileOverlay({ isVisible, onClose, onSuccess, onError }: TurnstileOverlayProps) {
  const { t } = useLocale()
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success'>('idle')
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
      queueMicrotask(() => {
        setStatus('idle')
        setIsClosing(false)
      })
    } else {
      document.body.style.overflow = 'unset'
      queueMicrotask(() => setIsClosing(false))
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
      className={`fixed inset-0 z-[100] flex items-center justify-center px-[var(--safe-x)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop - only this gets pointer-events when visible */}
      <div 
        className={`absolute inset-0 bg-purple/10 backdrop-blur-sm ${isVisible && !isClosing ? 'cursor-pointer' : ''}`}
        onClick={isVisible && !isClosing ? handleClose : undefined}
      />

      {/* Card */}
      <div 
        className={`relative w-full max-w-sm bg-white border-2 border-purple rounded-3xl shadow-[0_8px_0_var(--color-ink)] p-6 transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Close Button */}
        <button 
          onClick={handleClose}
          aria-label="Chiudi"
          className="absolute top-3 right-3 p-1.5 text-purple hover:bg-purple/10 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className={`
            relative p-3 rounded-full transition-all duration-500
            ${status === 'success' ? 'bg-bright' : 'bg-purple/10'}
          `}>
            {status === 'success' ? (
              <Star className="h-8 w-8 fill-ink stroke-ink stroke-2" />
            ) : (
              <Star className="h-8 w-8 fill-purple stroke-purple stroke-2" />
            )}
          </div>

          {/* Text */}
          <div className="space-y-1" aria-live="polite">
            <h2 className="text-lg font-black text-purple uppercase tracking-tight">
              {status === 'success' ? t('turnstile.ready') : t('turnstile.verify')}
            </h2>
            <p className="text-sm text-ink/70 max-w-[260px]">
              {status === 'success' ? (
                t('turnstile.voteOnItsWay')
              ) : (
                t('turnstile.confirmHuman')
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
                onError={() => onError(t('turnstile.error'))}
                options={{ theme: 'light' }}
              />
            )}
            
            {(status === 'verifying' || status === 'success') && (
              <div className="flex items-center gap-2 text-purple">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-bold uppercase tracking-wide">
                  {status === 'success' ? t('turnstile.ok') : t('turnstile.verifying')}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-ink/40 pt-2">
            {t('turnstile.noPersonalData')}
          </p>
        </div>
      </div>
    </div>
  )
}