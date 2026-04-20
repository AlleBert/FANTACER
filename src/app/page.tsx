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
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [activeBatch, setActiveBatch] = useState<string>('TEST')
  const [debugLoaded, setDebugLoaded] = useState(0)

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
    setHasVoted(hasAlreadyVoted())
    loadRanking()
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
    setLoading(true)
    
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

    const { data, error } = await dbQuery
    const companiesList = (data || []) as Company[]
    setCompanies(companiesList)
    setLoading(false)
    console.log('Loaded companies:', companiesList.length, 'batch:', batch)
    console.log('Button should show:', companiesList.length > 20)
    setDebugLoaded(companiesList.length)
  }, [supabase])

  const debouncedSearch = useDebouncedCallback((query: string) => {
    loadCompanies(query)
  }, 300)

  useEffect(() => {
    if (supabase) {
      loadCompanies('')
    }
  }, [supabase, loadCompanies])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleScroll = () => {
      setShowScrollButton(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    debouncedSearch(query)
  }

  const handleVote = async (companyId: string) => {
    if (!supabase || hasVoted || votingFor) return

    setVotingFor(companyId)
    setError(null)

    try {
      const fingerprint = await getCombinedFingerprint()
      
      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({ company_id: companyId, fingerprint })

      if (voteError) {
        if (voteError.message.includes('duplicate') || voteError.message.includes('unique')) {
          setError('Hai già votato oggi!')
        } else {
          setError(voteError.message)
        }
      } else {
        // Vote registered - update UI
        markVotedToday()
        setHasVoted(true)
      }
    } catch (err) {
      setError('Errore durante il voto')
    } finally {
      setVotingFor(null)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <GDPRBanner onAccept={setAnalyticsConsent} />
      
      <Header onSearch={handleSearch} hasVoted={hasVoted} />
      
      <div className="container px-4 py-4">
        <RankingBar ranking={ranking} limit={3} />
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg my-4">
            {error}
          </div>
        )}
        
        {hasVoted && !error && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-2 rounded-lg my-4">
            ✓ Voto registrato! Grazie per aver votato.
          </div>
        )}

        {!loading && companies.length > 20 && (
          <div className="text-center my-4">
            <button 
              onClick={() => { setShowAll(!showAll); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-sm text-accent hover:text-accent/80 underline"
            >
              {showAll ? 'Nascondi (' + companies.length + ')' : 'Visualizza tutte (' + companies.length + ')'}
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))
          ) : (
            (showAll ? companies : companies.slice(0, 20)).map((company) => {
              const rankItem = ranking.find(r => r.id === company.id)
              return (
                <CompanyCard
                  key={company.id}
                  company={{
                    ...company,
                    position: rankItem ? ranking.findIndex(r => r.id === company.id) + 1 : undefined
                  }}
                  onVote={handleVote}
                  disabled={hasVoted}
                  loading={votingFor === company.id}
                />
              )
            })
          )}
        </div>
        
        {!loading && companies.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna azienda trovata
          </div>
        )}
      </div>

      {showScrollButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:bg-accent/80 transition-colors z-[60]"
          aria-label="Torna su"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </main>
  )
}