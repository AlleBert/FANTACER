'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { createBrowserClient } from '@supabase/ssr'
import { getCombinedFingerprint, hasAlreadyVoted, markVotedToday } from '@/lib/fingerprint'
import { Header } from '@/components/layout/header'
import { CompanyCard } from '@/components/company-card'
import { RankingBar } from '@/components/ranking-bar'
import { GDPRBanner } from '@/components/gdpr-banner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { TurnstileOverlay } from '@/components/voting/turnstile-overlay'
const isVotingBypassEnabled = () => process.env.NEXT_PUBLIC_X7K2M9QS3P === 'hx7k2m9Qs3P'
import { motion, AnimatePresence } from 'framer-motion'
import { SplashPreloader } from '@/components/splash-preloader'
import { HeroSection } from '@/components/sections/hero-section'
import { IntroSection } from '@/components/sections/intro-section'
import { RulesSection } from '@/components/sections/rules-section'
import { DatesLocationSection } from '@/components/sections/dates-location-section'
import { SearchSection } from '@/components/sections/search-section'
import { PrizeSection } from '@/components/sections/prize-section'
import { ContactSection } from '@/components/sections/contact-section'
import { FooterSection } from '@/components/sections/footer-section'
import { SectionContainer } from '@/components/layout/section-container'
import { WavyDivider } from '@/components/ui/wavy-divider'

interface Company {
  id: string
  name: string
  category?: string
  image_url?: string
}

interface RankingItem {
  id: string
  name: string
  votes: number
  trend?: number
}

export default function Home() {
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null)
  if (!supabaseRef.current && typeof window !== 'undefined') {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  }
  const supabase = supabaseRef.current
  
  const [companies, setCompanies] = useState<Company[]>([])
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const [votingFor, setVotingFor] = useState<string | null>(null)
  const [analyticsConsent, setAnalyticsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [isSplashExiting, setIsSplashExiting] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [activeBatch, setActiveBatch] = useState<string>('TEST')
  const [debugLoaded, setDebugLoaded] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [showTurnstileOverlay, setShowTurnstileOverlay] = useState(false)
  const [pendingVoteCompanyId, setPendingVoteCompanyId] = useState<string | null>(null)

  const loadRanking = useCallback(async () => {
    if (!supabase) return
    const { data: votes } = await supabase.from('votes').select('company_id')
    
    const { data: companies } = await supabase.from('companies').select('id, name')
    const companyMap = new Map<string, string>((companies || []).map((c: { id: string; name: string }) => [c.id, c.name]))
    
    if (votes && votes.length > 0) {
      const voteCounts = new Map<string, number>()
      votes.forEach((v: { company_id: string }) => {
        voteCounts.set(v.company_id, (voteCounts.get(v.company_id) || 0) + 1)
      })
      
      const sorted = Array.from(voteCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([companyId, count]) => ({
          id: companyId,
          name: companyMap.get(companyId) || 'Unknown',
          votes: count
        }))
      
      setRanking(sorted)
    } else {
      const topCompanies = (companies || []).slice(0, 10).map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
        votes: 0
      }))
      setRanking(topCompanies)
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase || initialized) return
    setInitialized(true)
    
    // 1. Quick check from localStorage for better UX
    const localVoted = hasAlreadyVoted()
    const isBypass = isVotingBypassEnabled()
    setHasVoted(isBypass ? false : localVoted)
    loadRanking()

    // 2. Persistent check from server via Fingerprint (catches storage clearing)
    const syncWithServer = async () => {
      if (isBypass) return // Skip sync in bypass mode
      try {
        const fingerprint = await getCombinedFingerprint()
        const { data: canVote, error } = await supabase.rpc('check_can_vote', {
          fingerprint_param: fingerprint
        })
        
        if (!error && canVote === false) {
          console.log('Server-side check: User has already voted today.')
          setHasVoted(true)
          markVotedToday() // Restore local storage
        }
      } catch (err) {
        console.error('Failed to sync vote status with server:', err)
      }
    }

    syncWithServer()
  }, [supabase, initialized, loadRanking])

  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('ranking-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes'
        },
        () => loadRanking()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadRanking])

  const loadCompanies = useCallback(async (query: string) => {
    if (!supabase) return
    
    // Only show skeleton if we truly have no data and no query (first load)
    // Functional update prevents dependency on 'companies' array
    setLoading(prev => {
      if (companies.length === 0 && !query) return true
      return prev
    })
    
    try {
      const { data: settings } = await supabase
        .from('batch_settings')
        .select('active_batch')
        .eq('id', 'default')
        .single()
      
      const batch = settings?.active_batch || 'TEST'
      setActiveBatch(batch)

      let dbQuery = supabase
        .from('companies')
        .select('id, name, category, image_url')
        .eq('batch', batch)
        .order('name')

      if (query) {
        dbQuery = dbQuery.ilike('name', `%${query}%`)
      }

      const { data } = await dbQuery
      setCompanies((data || []) as Company[])
    } catch (err) {
      console.error('Error loading companies:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, companies.length])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    loadCompanies(query)
  }, 300)

  useEffect(() => {
    if (supabase && !initialized) {
      loadCompanies('')
    }
  }, [supabase, loadCompanies, initialized])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleScroll = () => {
      setShowScrollButton(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Stage 1: Keep splash active (0ms - 1200ms)
    
    // Stage 2: Start fade out
    const revealTimer = setTimeout(() => {
      setIsSplashExiting(true)
    }, 1200)

    // Stage 3: Remove splash after animation completes
    const moveTimer = setTimeout(() => {
      setShowSplash(false)
    }, 1800)

    return () => {
      clearTimeout(revealTimer)
      clearTimeout(moveTimer)
    }
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    debouncedSearch(query)
  }, [debouncedSearch])

  const handleVote = async (companyId: string, tokenOverride?: string) => {
    if (hasVoted || votingFor) return

    const currentToken = tokenOverride || turnstileToken
    const isBypass = isVotingBypassEnabled()

    // If no turnstile token, show the overlay first
    if (!currentToken && !isBypass) {
      console.log('handleVote: No token, opening overlay')
      setPendingVoteCompanyId(companyId)
      setShowTurnstileOverlay(true)
      return
    }

    const effectiveToken = isBypass ? 'debug-bypass-token' : currentToken
    console.log('handleVote: Voting', { 
      companyId, 
      tokenSource: isBypass ? 'bypass' : (tokenOverride ? 'override' : 'state') 
    })

    setVotingFor(companyId)
    setError(null)

    try {
      const fingerprint = await getCombinedFingerprint()
      
      const response = await fetch('/api/vota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          company_id: companyId, 
          fingerprint,
          turnstile_token: effectiveToken,
          metadata: {
            screen: `${window.screen.width}x${window.screen.height}`,
            userAgent: navigator.userAgent,
            isBypass
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.warn('handleVote: POST failed', result)
        setError(result.error || 'Errore durante il voto')
        // If the server says we already voted, sync the local state
        if (result.error === 'Hai già votato oggi') {
          markVotedToday()
          setHasVoted(true)
        }
        // If token was invalid/expired, clear it so user can try again
        if (response.status === 403 || result.error?.includes('Turnstile')) {
          setTurnstileToken(null)
        }
      } else {
        console.log('handleVote: POST success')
        markVotedToday()
        setHasVoted(true)
        loadRanking()
      }
    } catch (err) {
      setError('Errore di connessione')
    } finally {
      setVotingFor(null)
    }
  }

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token)
    // If we were waiting for a vote, trigger it now with the fresh token
    if (pendingVoteCompanyId) {
      const companyId = pendingVoteCompanyId
      setPendingVoteCompanyId(null)
      // Small timeout to let the overlay close animation finish
      setTimeout(() => {
        handleVote(companyId, token)
      }, 100)
    }
  }
  return (
    <main className="min-h-screen w-full flex-1 bg-background select-none">
      <AnimatePresence>
        {showSplash && <SplashPreloader key="splash" isExiting={isSplashExiting} />}
      </AnimatePresence>

      <div className={isSplashExiting ? 'opacity-100 transition-opacity duration-500' : 'opacity-0'}>
        <GDPRBanner onAccept={setAnalyticsConsent} />
        
        {/* New SPA Sections */}
        <HeroSection />
        <WavyDivider color="#FF00FF" />
        
        <IntroSection />
        <WavyDivider color="#6B21A8" />
        
        <RulesSection />
        <WavyDivider color="#FF8C00" />
        
        <DatesLocationSection />
        
        {/* Interactive Voting Section */}
        <SearchSection onSearch={handleSearch} />
        
        <SectionContainer className="bg-white py-8" id="voting-results" fullHeight={false}>
          <div className="w-full">
            {!searchQuery && <RankingBar ranking={ranking} limit={3} />}
            
            <TurnstileOverlay 
              isVisible={showTurnstileOverlay}
              onClose={() => { setShowTurnstileOverlay(false); setPendingVoteCompanyId(null); }}
              onSuccess={handleTurnstileSuccess}
              onError={(msg) => { setError(msg); setShowTurnstileOverlay(false); }}
            />
            
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-6 py-4 rounded-3xl my-6 font-bold text-center">
                {error}
              </div>
            )}
            
            {hasVoted && !error && (
              <div className="bg-green-500/10 border border-green-500 text-green-500 px-6 py-4 rounded-3xl my-6 font-bold text-center flex flex-col items-center gap-4">
                <span className="text-3xl">✓ sei forte!</span>
                <span className="text-xl">Voto registrato. Grazie per aver partecipato!</span>
              </div>
            )}

            {!loading && companies.length > 20 && (
              <div className="text-center my-8">
                <Button 
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="rounded-full px-12 bg-magenta-500 border-transparent text-white hover:bg-magenta-600 font-black transition-all duration-300 h-14 text-xl shadow-xl"
                >
                  {showAll ? 'Nascondi risultati' : `Visualizza tutte (${companies.length})`}
                </Button>
              </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                  {(showAll ? companies : companies.slice(0, 20)).map((company, index) => {
                    const rankItem = ranking.find(r => r.id === company.id)
                    return (
                      <motion.div
                        key={company.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CompanyCard
                          company={{
                            ...company,
                            position: rankItem ? ranking.findIndex(r => r.id === company.id) + 1 : undefined
                          }}
                          onVote={handleVote}
                          disabled={hasVoted}
                          loading={votingFor === company.id}
                        />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
            </div>

            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 mt-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-4 bg-gray-50 p-4 rounded-3xl">
                    <Skeleton className="aspect-square rounded-2xl" />
                    <Skeleton className="h-6 w-3/4 rounded-full" />
                    <Skeleton className="h-12 w-full rounded-full" />
                  </div>
                ))}
              </div>
            )}
            
            {!loading && companies.length === 0 && (
              <div className="text-center py-20 text-2xl font-bold text-gray-400">
                Nessuna azienda trovata
              </div>
            )}
          </div>
        </SectionContainer>

        <PrizeSection />
        <ContactSection />
        <FooterSection />

        {showScrollButton && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 w-16 h-16 bg-magenta-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-magenta-600 transition-all z-[60] hover:scale-110 active:scale-95"
            aria-label="Torna su"
          >
            <ArrowUp className="h-8 w-8 stroke-[3]" />
          </button>
        )}
      </div>
    </main>
  )
}