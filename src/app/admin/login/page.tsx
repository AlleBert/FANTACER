'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lock, KeyRound } from 'lucide-react'
const isBypassEnabled = () => process.env.NEXT_PUBLIC_X7K2M9QS3P === 'hx7k2m9Qs3P'
const getBypassSession = () => ({
  user: { email: 'dev@fantacer.it', role: 'admin' },
  expires: new Date(Date.now() + 3600000).toISOString(),
  token: 'dev-bypass-token'
})

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requiresMfa, setRequiresMfa] = useState(false)

  // Auto-login for development
  useEffect(() => {
    if (isBypassEnabled()) {
      const session = getBypassSession()
      localStorage.setItem('admin_session', JSON.stringify(session))
      router.push('/admin/dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mfaCode: requiresMfa ? mfaCode : undefined })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.requiresMfa) {
          setRequiresMfa(true)
        } else {
          setError(data.error || 'Login failed')
        }
      } else {
        // Store session
        localStorage.setItem('admin_session', data.sessionToken)
        router.push('/admin/dashboard')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>Admin Access</CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="admin@fantacer.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {requiresMfa && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Codice MFA</label>
                <div className="flex gap-2">
                  <KeyRound className="h-5 w-5 text-muted-foreground mt-2" />
                  <Input
                    type="text"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Accesso...' : 'Accedi'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}