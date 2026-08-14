'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/sidebar'
import { BottomNav } from '@/components/admin/bottom-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mfaExpired, setMfaExpired] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const res = await fetch('/api/admin/me')
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/admin/login')
            return
          }
          setChecking(false)
          return
        }
        const data = await res.json()
        
        if (data.mfaExpired && data.factorId) {
          setMfaExpired(true)
          setFactorId(data.factorId)
          
          // Create challenge
          const challengeRes = await fetch('/api/admin/mfa/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factorId: data.factorId })
          })
          const challengeData = await challengeRes.json()
          if (challengeRes.ok) {
            setChallengeId(challengeData.challengeId)
          }
        }
      } catch (err) {
        console.error('MFA check error:', err)
      } finally {
        setChecking(false)
      }
    }
    
    checkMfaStatus()
  }, [router])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, challengeId, code })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Codice non valido')
        return
      }

      setMfaExpired(false)
      setCode('')
      router.refresh()
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (mfaExpired && factorId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-950/30 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle>Verifica di sicurezza</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              La verifica MFA è scaduta. Inserisci il codice per continuare.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Codice di sicurezza</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-sm text-red-500">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifica...' : 'Verifica'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background transition-colors duration-300">
      <AdminSidebar
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`transition-all duration-300 min-h-dvh pb-16 md:pb-0 overflow-x-hidden ${
          isSidebarCollapsed ? 'md:ml-[var(--admin-sidebar-width-collapsed)]' : 'md:ml-[var(--admin-sidebar-width)]'
        }`}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}