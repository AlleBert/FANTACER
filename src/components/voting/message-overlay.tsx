'use client'

import { useState, useEffect } from 'react'
import { Star, X } from 'lucide-react'

type MessageType = 'success' | 'error' | 'warning' | 'info'

interface MessageOverlayProps {
  isVisible: boolean
  type?: MessageType
  title: string
  message: string
  confirmText?: string
  onConfirm?: () => void
  onClose: () => void
}

const typeStyles = {
  success: {
    bg: 'bg-[#fccb27]',
    border: 'border-[#fccb27]',
    iconBg: 'bg-[#fccb27]',
    text: 'text-[#231f20]',
    iconColor: 'stroke-[#231f20]',
  },
  error: {
    bg: 'bg-[#ff803b]',
    border: 'border-[#ff803b]',
    iconBg: 'bg-[#ff803b]',
    text: 'text-white',
    iconColor: 'stroke-white',
  },
  warning: {
    bg: 'bg-[#ff803b]',
    border: 'border-[#ff803b]',
    iconBg: 'bg-[#ff803b]',
    text: 'text-white',
    iconColor: 'stroke-white',
  },
  info: {
    bg: 'bg-[#8000ff]',
    border: 'border-[#8000ff]',
    iconBg: 'bg-[#8000ff]',
    text: 'text-white',
    iconColor: 'stroke-white',
  },
}

export function MessageOverlay({ 
  isVisible, 
  type = 'info', 
  title, 
  message, 
  confirmText,
  onConfirm, 
  onClose 
}: MessageOverlayProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [showContent, setShowContent] = useState(false)

  const styles = typeStyles[type]

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        setShowContent(true)
        setIsClosing(false)
      }, 0)
    } else {
      document.body.style.overflow = 'unset'
      setIsClosing(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isVisible])

  const handleClose = () => {
    setIsClosing(true)
    setShowContent(false)
    setTimeout(onClose, 300)
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    handleClose()
  }

  if (!isVisible && !isClosing) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop - only this gets click handler when visible */}
      <div 
        className={`absolute inset-0 bg-[#8000ff]/10 backdrop-blur-sm ${isVisible && !isClosing ? 'cursor-pointer' : ''}`}
        onClick={isVisible && !isClosing ? handleClose : undefined}
      />

      {/* Card */}
      <div 
        className={`relative w-full max-w-sm bg-white border-2 ${styles.border} rounded-3xl shadow-[0_8px_0_#231f20] p-6 transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 text-[#231f20]/50 hover:bg-[#231f20]/10 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className={`
            relative p-3 rounded-full transition-all duration-500
            ${styles.iconBg}
          `}>
            <Star className={`h-8 w-8 fill-none ${styles.iconColor} stroke-[2]`} />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h2 className={`text-xl font-black uppercase tracking-tight ${styles.text}`}>
              {title}
            </h2>
            <p className="text-sm text-[#231f20]/70 max-w-[260px] leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          {confirmText && onConfirm && (
            <button
              onClick={handleConfirm}
              className={`
                mt-2 px-8 py-3 rounded-full font-[900] text-lg uppercase tracking-tight
                border-2 border-[#231f20] shadow-[4px_4px_0_#231f20]
                hover:shadow-[6px_6px_0_#231f20] hover:-translate-y-1
                transition-all duration-300
                ${type === 'warning' || type === 'error' ? 'bg-white' : 'bg-[#8000ff]'}
                ${type === 'warning' || type === 'error' ? 'text-[#ff803b]' : 'text-white'}
              `}
            >
              {confirmText}
            </button>
          )}

          {/* Footer */}
          <p className="text-[10px] text-[#231f20]/40 pt-2">
            Fantacer - Manifestazione Ceramica
          </p>
        </div>
      </div>
    </div>
  )
}