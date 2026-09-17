'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SponsorCards } from '@/components/sponsor/sponsor-cards';
import { SectionFrame } from '@/components/layout/section-frame';
import { SafeCenterSection } from '@/components/layout/safe-center-section';
import { useLocale } from '@/lib/LocaleContext';
import { useVote } from '@/lib/VoteContext';
import { useSponsorMaxItems } from '@/hooks/use-sponsor-max-items';
import { useRankingTick, useRealtime } from '@/lib/RealtimeContext';
import {
  CLUSTERS,
  CLUSTER_ORDER,
  getCluster,
  rankCompanies,
  type Cluster,
  type RankingCompany,
} from '@/lib/ranking';
import { cn } from '@/lib/utils';

// Polling di fallback per i client senza realtime attivo (es. oltre il limite
// di connessioni Realtime). Il CDN cachea `/api/public/ranking` (s-maxage 3s),
// quindi 30s per client è sufficiente e riduce di 3x le invocazioni.
export const PALLETS_POLLING_MS = 30000;

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

interface LiveRankingSectionProps {
  showWhenDisabled?: boolean
}

export function LiveRankingSection({ showWhenDisabled = false }: LiveRankingSectionProps) {
  const { t } = useLocale()
  const { selectedCompanies, gameUnlock } = useVote()
  const maxItems = useSponsorMaxItems()
  const { votingEnabled, realtimeActive, rankingVersion, visible } = useRealtime()
  const [companies, setCompanies] = useState<RankingCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<Cluster, boolean>>(getInitialOpen)
  const [isVisible, setIsVisible] = useState(true)
  const [flash, setFlash] = useState<Record<Cluster, number>>({ TOP20: 0, GOLD: 0, SILVER: 0, BRONZE: 0 })

  const sectionRef = useRef<HTMLDivElement>(null)
  const prevBandSig = useRef<Record<Cluster, string>>({ TOP20: '', GOLD: '', SILVER: '', BRONZE: '' })
  const lastVersion = useRef(rankingVersion)
  const prevVisible = useRef(visible)

  // Il canale ranking_tick è richiesto solo quando la sezione è visibile e il voto
  // è attivo; il provider lo condivide (refcount) e lo sospende in background.
  useRankingTick(isVisible && votingEnabled)

  const votedIds = useMemo(
    () => new Set(gameUnlock.success ? selectedCompanies.map((s) => s.company.id) : []),
    [selectedCompanies, gameUnlock.success],
  )

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
  // la rule è conservativa e non distingue questo caso. Gira quando la sezione è
  // davvero renderizzata: a voto attivo, oppure a voto disattivo con showWhenDisabled
  // (classifica visibile pre-fiera). A voto disattivo senza showWhenDisabled la
  // sezione è null e il fetch è inutile (riparte quando il flag va true).
  useEffect(() => {
    if (!votingEnabled && !showWhenDisabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRanking()
  }, [fetchRanking, votingEnabled, showWhenDisabled])

  // Polling di fallback (10s): attivo solo se il voto è attivo, il realtime non
  // ha ancora consegnato un evento reale, la sezione è in viewport e la scheda è
  // visibile. Mai con loader: gli aggiornamenti successivi sono silenziosi.
  useEffect(() => {
    const interval = setInterval(() => {
      if (votingEnabled && !realtimeActive && isVisible && visible) fetchRanking(false)
    }, PALLETS_POLLING_MS)
    return () => clearInterval(interval)
  }, [fetchRanking, realtimeActive, isVisible, visible, votingEnabled])

  // Viewport: la classifica si aggiorna quando entra a schermo. Il canale
  // ranking_tick è gestito dal provider (refcount, sospeso in background): qui
  // resta l'osservazione dell'intersezione e il fetch al rientro.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    // jsdom non implementa IntersectionObserver: in test env il realtime non
    // viene cablato (il comportamento è coperto dai test del provider).
    if (typeof IntersectionObserver === 'undefined') return

    const io = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
      if (entry.isIntersecting) fetchRanking(false)
    })
    io.observe(section)
    return () => io.disconnect()
  }, [fetchRanking])

  // Refetch quando il provider segnala un evento ranking_tick (il debounce è nel
  // provider). Si salta il primo giro: il mount è coperto dal fetch iniziale.
  useEffect(() => {
    if (rankingVersion === lastVersion.current) return
    lastVersion.current = rankingVersion
    if (!isVisible) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRanking(false)
  }, [rankingVersion, isVisible, fetchRanking])

  // Catch-up al ritorno in primo piano: in background la scheda non riceve i
  // tick, quindi al resume si riallinea la classifica (se in viewport).
  useEffect(() => {
    const wasVisible = prevVisible.current
    prevVisible.current = visible
    if (!visible || wasVisible) return
    if (!isVisible) return
    if (!votingEnabled && !showWhenDisabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRanking(false)
  }, [visible, isVisible, votingEnabled, showWhenDisabled, fetchRanking])

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

  // Pre-fiera (voto disattivo) la classifica non deve esistere nel DOM:
  // nessuna sezione, nessuno skeleton. Il flag voting_enabled (admin) la
  // ripristina dal lunedì di fiera.
  // Se showWhenDisabled è true, mostriamo comunque la classifica.
  if (!votingEnabled && !showWhenDisabled) return null

  return (
    <SectionFrame theme="live-ranking" className="flex flex-col">
      <SafeCenterSection scrollable={false} gap="var(--rythm-blk)" className="content-max">
        <div ref={sectionRef} className="w-full flex flex-col items-center gap-(--rythm-blk)">
          <h2 className="text-(length:--fs-headline-tight) font-[900] text-center tracking-tighter lowercase leading-(--lh-headline) text-white">
            {t('liveRanking.title')}
          </h2>
          <p className="text-center text-[clamp(0.875rem,2.5vw,1.125rem)] font-bold text-white">
            {t('liveRanking.subtitle')}
          </p>

          <div className="w-full max-w-2xl mx-auto">
            {isLoading ? (
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
              <>
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
                            <span className={cn('truncate', def.showScore && 'text-lg md:text-xl leading-none')}>
                              {def.label}
                              {!def.showScore && ` · ${def.min}-${def.max}`}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {badge && (
                              <span
                                key={flash[cluster]}
                                className={cn(
                                  'bg-purple text-white text-xs font-black rounded-full px-2 py-0.5 border border-ink whitespace-nowrap inline-flex items-center gap-1 min-w-0',
                                  flash[cluster] > 0 && 'animate-pulse',
                                )}
                              >
                                {badge}
                              </span>
                            )}
                            <span aria-hidden="true" className="text-xs">{isOpen ? '▾' : '▸'}</span>
                          </span>
                        </button>

                        <div
                          id={panelId}
                          aria-hidden={!isOpen}
                          className={cn(
                            'grid transition-[grid-template-rows] duration-300 ease-in-out',
                            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                          )}
                        >
                          <div className="overflow-hidden min-h-0">
                            <ul className="flex flex-col gap-y-1 py-1">
                              {bandCompanies.map((company) => {
                                const isMine = votedIds.has(company.id)
                                const rankDisplay = company.rank <= 3 ? ['🥇', '🥈', '🥉'][company.rank - 1] : `#${company.rank}`
                                return (
                                  <li key={company.id}>
                                    <div
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
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>
                <p className="mt-(--rythm-blk) text-center text-[clamp(0.6875rem,2vw,0.9rem)] font-medium text-white/90 [text-wrap:balance]">
                  {t('liveRanking.tieBreak')}
                </p>
              </>
            )}
          </div>
        </div>
      </SafeCenterSection>

      {/* Sponsor footer fisso */}
      <div className="flex-shrink-0 w-full flex justify-center p-(--space-md)">
        <SponsorCards variant="compact" maxItems={maxItems} />
      </div>
    </SectionFrame>
  );
}
