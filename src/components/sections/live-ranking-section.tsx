'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { useLocale } from '@/lib/LocaleContext';
import { useVote } from '@/lib/VoteContext';
import { createClient } from '@/lib/supabase/client';
import {
  CLUSTERS,
  CLUSTER_ORDER,
  getCluster,
  rankCompanies,
  type Cluster,
  type RankingCompany,
} from '@/lib/ranking';
import { cn } from '@/lib/utils';

const PALLETS_POLLING_MS = 30000;
const REFETCH_DEBOUNCE_MS = 500;

function getInitialOpen(): Record<Cluster, boolean> {
  return { TOP20: true, GOLD: false, SILVER: false, BRONZE: false };
}

function bandBadge(
  t: (key: string, vars?: Record<string, unknown>) => string,
  votedInBand: RankingCompany[],
): ReactNode {
  const n = votedInBand.length
  if (n === 1) {
    const c = votedInBand[0]
    return (
      <span className="flex items-center gap-1 min-w-0">
        <span className="shrink-0">#{c.rank}</span>
        <span className="truncate max-w-[8rem]">{c.name}</span>
      </span>
    )
  }
  if (n === 2) {
    return `2 · ${votedInBand.map((c) => `#${c.rank}`).join(' ')}`
  }
  return `${n} · ${t('liveRanking.yourVotes')}`
}

export function LiveRankingSection() {
  const { t } = useLocale()
  const { selectedCompanies } = useVote()
  const [companies, setCompanies] = useState<RankingCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votingEnabled, setVotingEnabled] = useState(true)
  const [open, setOpen] = useState<Record<Cluster, boolean>>(getInitialOpen)
  const [channelActive, setChannelActive] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [flash, setFlash] = useState<Record<Cluster, number>>({ TOP20: 0, GOLD: 0, SILVER: 0, BRONZE: 0 })

  const sectionRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevBandSig = useRef<Record<Cluster, string>>({ TOP20: '', GOLD: '', SILVER: '', BRONZE: '' })

  const votedIds = useMemo(() => new Set(selectedCompanies.map((s) => s.company.id)), [selectedCompanies])

  const fetchRanking = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/public/ranking')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      const ranked = rankCompanies((data.companies || []) as Array<Omit<RankingCompany, 'rank'>>)
      setCompanies(ranked)
    } catch {
      if (showLoader) setError(t('liveRanking.error'))
    } finally {
      if (showLoader) setIsLoading(false)
    }
  }, [t])

  // Initial fetch al mount (unico, con loader sul primo caricamento). Il setState
  // sincrono (setIsLoading(true)) è un no-op benigno (isLoading è già true al mount);
  // la rule è conservativa e non distingue questo caso.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRanking()
  }, [fetchRanking])

  // Polling di fallback: solo se il channel non è attivo e la sezione è visibile.
  // Mai con loader: gli aggiornamenti successivi sono silenziosi.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!channelActive && isVisible) fetchRanking(false)
    }, PALLETS_POLLING_MS)
    return () => clearInterval(interval)
  }, [fetchRanking, channelActive, isVisible])

  // Realtime channel su ranking_tick (primario), sospeso fuori viewport.
  // ranking_tick è una tabella "tick" con solo un contatore di versione (no
  // PII) e una policy anon select: gli eventi Realtime vengono consegnati ai
  // client pubblici, che poi refetchano /api/public/ranking. vote_sessions
  // resta chiuso ai client (solo service_role), quindi NON va sottoscritto qui.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // jsdom non implementa IntersectionObserver: in test env il realtime non
    // viene cablato (il comportamento è coperto separatamente in Task 6).
    if (typeof IntersectionObserver === 'undefined') return

    const supabase = createClient()

    const startChannel = () => {
      if (channelRef.current) return
      const channel = supabase
        .channel('live-ranking-votes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'ranking_tick' },
          () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              fetchRanking(false)
              setChannelActive(true)
            }, REFETCH_DEBOUNCE_MS)
          }
        )
        .subscribe((status) => {
          // MAI attivare il realtime dal solo status di socket: Supabase Realtime
          // consegna gli eventi solo se l'RLS del subscriber li autorizza. Con
          // ranking_tick (policy anon select, solo un contatore, nessuna PII) il
          // client pubblico riceve davvero gli eventi, ma channelActive va comunque
          // impostato SOLO alla consegna reale di un evento (nell'handler sopra):
          // se un subscriber non è autorizzato riceve SUBSCRIBED ma ZERO eventi, e
          // senza questa guardia il polling fallback si congelerebbe.
          if (status !== 'SUBSCRIBED') setChannelActive(false)
        })
      channelRef.current = channel
    }

    const stopChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setChannelActive(false)
    }

    const io = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
      if (entry.isIntersecting) {
        startChannel()
        fetchRanking(false)
      } else {
        stopChannel()
      }
    })
    io.observe(section)

    // voting flag channel (invariato rispetto all'esistente)
    const flagChannel = supabase
      .channel('live-ranking-voting-flag')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: 'key=eq.voting_enabled' }, () => {
        fetch('/api/public/flag/voting').then((res) => res.json()).then((d) => setVotingEnabled(d.enabled)).catch(() => {})
      })
      .subscribe()

    return () => {
      io.disconnect()
      stopChannel()
      supabase.removeChannel(flagChannel)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchRanking])

  // voting flag initial fetch
  useEffect(() => {
    fetch('/api/public/flag/voting').then((res) => res.json()).then((d) => setVotingEnabled(d.enabled)).catch(() => {})
  }, [])

  const toggleBand = (cluster: Cluster) => {
    setOpen((prev) => ({ ...prev, [cluster]: !prev[cluster] }))
  }

  // raggruppa per fascia (ordine fisso fasce)
  const bands = useMemo(() => {
    const groups: Record<Cluster, RankingCompany[]> = {
      TOP20: [], GOLD: [], SILVER: [], BRONZE: [],
    }
    for (const c of companies) {
      const cluster = getCluster(c.rank)
      groups[cluster].push(c)
    }
    return CLUSTER_ORDER.map((key) => ({ cluster: key, companies: groups[key] }))
  }, [companies])

  const reduced = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false),
    [],
  )

  // Pulse badge: quando il voto utente cambia posizione in una fascia CHIUSA,
  // il badge header fa un breve flash (1-2 cicli animate-pulse). La firma è la
  // lista dei rank votati nella fascia; il primo calcolo inizializza il ref
  // senza flash (prevBandSig '' → nessun confronto).
  useEffect(() => {
    const changed: Cluster[] = []
    for (const { cluster, companies: bandCompanies } of bands) {
      if (bandCompanies.length === 0) continue
      const votedInBand = bandCompanies.filter((c) => votedIds.has(c.id))
      if (votedInBand.length === 0) continue
      const sig = votedInBand.map((c) => c.rank).join(',')
      // solo fasce chiuse: registra sempre la sig ma fai pulse solo se chiusa
      if (!open[cluster] && prevBandSig.current[cluster] !== '' && prevBandSig.current[cluster] !== sig) {
        changed.push(cluster)
      }
      prevBandSig.current[cluster] = sig
    }
    if (changed.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlash((f) => {
        const next = { ...f }
        for (const c of changed) next[c] += 1
        return next
      })
    }
  }, [bands, open, votedIds])

  // Riporta flash a 0 dopo un breve intervallo: il pulse si spegne da solo.
  useEffect(() => {
    if (Object.values(flash).every((f) => f === 0)) return
    const t = setTimeout(() => setFlash({ TOP20: 0, GOLD: 0, SILVER: 0, BRONZE: 0 }), 1000)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <SectionFrame theme="live-ranking" className="flex flex-col justify-between">
      <div ref={sectionRef} className="safe-shell content-max flex flex-col h-full min-h-0">
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-(--rythm-blk)">
          <h2 className="text-(length:--fs-headline-tight) font-[900] text-center tracking-tighter lowercase leading-(--lh-headline) text-white">
            {t('liveRanking.title')}
          </h2>
          <p className="text-center text-[clamp(0.875rem,2.5vw,1.125rem)] font-bold text-white">
            {t('liveRanking.subtitle')}
          </p>

          <div className="w-full max-w-2xl mx-auto">
            {!votingEnabled ? (
              <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000] p-3 md:p-6">
                <div className="flex flex-col gap-y-2 md:gap-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="mb-3 animate-pulse">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 bg-gray-300 rounded-full" />
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <div className="h-4 bg-gray-300 rounded w-3/5" />
                            <div className="h-5 bg-gray-300 rounded-full w-16 ml-2" />
                          </div>
                          <div className="w-full h-4 bg-gray-300 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <p className="text-lg font-black text-gray-500">
                    🏆 Classifica disponibile durante il Cersaie!
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mb-3 animate-pulse">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-white/30 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-white/30 rounded w-3/5" />
                      <div className="h-5 bg-white/30 rounded-full w-16 ml-2" />
                    </div>
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-white font-bold text-lg mb-4">{error}</p>
                <button
                  onClick={() => fetchRanking(true)}
                  className="bg-bright text-black font-black px-8 py-3 rounded-full border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-0.5 transition-all"
                >
                  {t('liveRanking.retry')}
                </button>
              </div>
            ) : companies.length === 0 ? (
              <p className="text-center text-white font-bold text-lg py-8">
                {t('liveRanking.empty')}
              </p>
            ) : (
              <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl border-[3px] border-black shadow-[4px_4px_0_#000] p-3 md:p-6 flex flex-col shrink min-h-0 max-h-[60svh]">
                <div className="no-scrollbar flex flex-col flex-1 overflow-y-auto gap-y-2 md:gap-y-3">
                  {bands.map(({ cluster, companies: bandCompanies }) => {
                    const def = CLUSTERS[cluster]
                    const isOpen = open[cluster]
                    const votedInBand = bandCompanies.filter((c) => votedIds.has(c.id))
                    const badge = votedInBand.length > 0 ? bandBadge(t as (k: string, v?: Record<string, unknown>) => string, votedInBand) : null
                    const panelId = `live-ranking-band-${cluster.toLowerCase()}`

                    return (
                      <div key={cluster}>
                        <button
                          type="button"
                          onClick={() => toggleBand(cluster)}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-3 min-h-11 border-2 border-ink font-[900] text-sm md:text-base cursor-pointer transition-colors',
                            isOpen ? 'bg-bright' : 'bg-gray-100 hover:bg-gray-200',
                          )}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{def.label} · {def.min}-{def.max}</span>
                            {!def.showScore && (
                              <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
                                {t('liveRanking.bandCount', { count: bandCompanies.length })}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {badge && (
                              <span
                                key={flash[cluster]}
                                className={cn(
                                  'bg-purple text-white text-xs font-black rounded-full px-2 py-0.5 border border-ink whitespace-nowrap inline-flex items-center gap-1 min-w-0',
                                  !reduced && flash[cluster] > 0 && 'animate-pulse',
                                )}
                              >
                                {badge}
                              </span>
                            )}
                            <span aria-hidden="true" className="text-xs">{isOpen ? '▾' : '▸'}</span>
                          </span>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={panelId}
                              initial={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
                              transition={{ duration: reduced ? 0 : 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <ul className="flex flex-col gap-y-1 py-1">
                                {bandCompanies.map((company) => {
                                  const isMine = votedIds.has(company.id)
                                  const rankDisplay = company.rank <= 3 ? ['🥇', '🥈', '🥉'][company.rank - 1] : `#${company.rank}`
                                  return (
                                    <li key={company.id}>
                                      <motion.div
                                        layout={!reduced}
                                        className={cn(
                                          'flex items-center gap-3 rounded-lg px-2 py-1.5',
                                          isMine && 'bg-purple/10 border-2 border-purple',
                                        )}
                                      >
                                        <span className="w-8 shrink-0 text-center font-black text-sm">{rankDisplay}</span>
                                        <span className={cn('flex-1 min-w-0 truncate font-bold text-sm md:text-base', isMine && 'text-purple')}>
                                          {company.name}
                                        </span>
                                        {isMine && (
                                          <span className="bg-purple text-white text-[10px] font-black rounded-full px-2 py-0.5 border border-ink whitespace-nowrap shrink-0">
                                            {t('liveRanking.yourVote')}
                                          </span>
                                        )}
                                        {def.showScore && (
                                          <span className="font-black text-sm bg-bright px-2 py-0.5 rounded-full border-2 border-ink whitespace-nowrap shrink-0">
                                            {t('liveRanking.pallets', { count: company.total_pallets })}
                                          </span>
                                        )}
                                      </motion.div>
                                    </li>
                                  )
                                })}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto w-full flex justify-center">
          <SponsorCards variant="compact" />
        </div>
      </div>
    </SectionFrame>
  );
}
