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
 * Cattura errori di render del blocco cookie (CookieManager + Analytics +
 * CookieConsentUI). Su browser mobile con site-data bloccati (Safari private
 * browsing, "Prevent Cross-Site Tracking", in-app browser) `document.cookie`
 * lancia SecurityError: `react-cookie-manager@5.3.0#getCookie()` lo legge
 * senza try/catch nell'initializer di useState di <CookieManager>. Un'eccezione
 * non gestita farebbe rendere `global-error.tsx` → phantom 500 client-side con
 * HTTP 200 dal server.
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