'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ConsentErrorBoundaryProps {
  children: ReactNode
  /** Contenuto della pagina: unico fallback sicuro (niente banner, niente Analytics). */
  fallback: ReactNode
}

interface ConsentErrorBoundaryState {
  hasError: boolean
}

/**
 * Cattura errori di render del blocco cookie (Analytics + CookieConsentUI).
 * `readConsentCookie()` (consent-cookie core) è no-throw, quindi il
 * SecurityError di `document.cookie` su browser con site-data bloccati (Safari
 * private browsing, "Prevent Cross-Site Tracking", in-app browser) non arriva
 * qui. Il boundary resta come rete di sicurezza: se qualcos'altro fallisce nel
 * blocco, evita `global-error.tsx` → phantom 500 client-side con HTTP 200 dal
 * server.
 *
 * Il fallback rende SOLO il contenuto della pagina: il sito funziona, senza
 * banner cookie e senza Analytics.
 */
export class ConsentErrorBoundary extends Component<ConsentErrorBoundaryProps, ConsentErrorBoundaryState> {
  state: ConsentErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ConsentErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      '[ConsentErrorBoundary] blocco cookie/analytics non renderizzabile, pagina servita senza tracking:',
      error,
      errorInfo
    )
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}