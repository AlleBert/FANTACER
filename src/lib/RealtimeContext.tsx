'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { safeOnPostgresChanges, safeSubscribe } from '@/lib/supabase/realtime';

/**
 * Realtime centralizzato per la homepage.
 *
 * Un solo client (`createBrowserClient` è già singleton: una socket per scheda) e
 * un solo canale per tabella, condiviso dai componenti:
 * - `site_settings` (flag `voting_enabled`) → `votingEnabled`
 * - `ranking_tick` → `rankingVersion` (debounced) + `realtimeActive`
 *
 * Il canale `ranking_tick` è aperto solo se almeno un consumer lo richiede
 * (`useRankingTick`) e la scheda è visibile (refcount). Quando la scheda torna
 * visibile i canali vengono ri-sottoscritti e il flag viene ri-fetchato
 * (catch-up); i consumer ri-fetchano la classifica reagendo a `visible`.
 */
const RANKING_DEBOUNCE_MS = 500;
const VOTING_FLAG_CHANNEL = 'realtime-voting-flag';
const RANKING_TICK_CHANNEL = 'realtime-ranking-tick';

interface RealtimeContextType {
  votingEnabled: boolean;
  votingEnabledLoaded: boolean;
  rankingVersion: number;
  realtimeActive: boolean;
  /** Visibilità della scheda (`document.visibilityState === 'visible'`). */
  visible: boolean;
  /** Registra un consumer del canale `ranking_tick`; ritorna la funzione di rilascio. */
  acquireRanking: () => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

function initialVisible(): boolean {
  return typeof document === 'undefined' ? true : !document.hidden;
}

/** Il realtime è un enhancement: se il client non è costruibile si degrada. */
function safeClient(): ReturnType<typeof createClient> | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  // Ottimistico: il flag parte da `true` (come il default storico della preview
  // di ricerca) e viene corretto dal fetch; evita un flash "Quanta fretta!" e il
  // rimontaggio tardivo della UI di ricerca (che sposterebbe i portal nel DOM).
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [votingEnabledLoaded, setVotingEnabledLoaded] = useState(false);
  const [rankingVersion, setRankingVersion] = useState(0);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [visible, setVisible] = useState(initialVisible);
  const [rankingNeeded, setRankingNeeded] = useState(false);

  const rankingDemand = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVotingFlag = useCallback(async () => {
    try {
      const res = await fetch('/api/public/flag/voting');
      const data = await res.json();
      setVotingEnabled(!!data?.enabled);
    } catch {
      // realtime/fetch non disponibili: mantiene l'ultimo valore noto
    } finally {
      setVotingEnabledLoaded(true);
    }
  }, []);

  // Visibilità scheda: pausa/riprende i canali.
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Flag voto: fetch iniziale + canale (solo a scheda visibile).
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVotingFlag();

    const supabase = safeClient();
    if (!supabase) return;
    const channel = safeOnPostgresChanges(
      supabase.channel(VOTING_FLAG_CHANNEL),
      { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: 'key=eq.voting_enabled' },
      () => {
        fetchVotingFlag();
      },
    );
    if (!channel) return;
    safeSubscribe(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, fetchVotingFlag]);

  // Classifica: canale aperto solo con almeno un consumer e scheda visibile.
  useEffect(() => {
    if (!visible || !rankingNeeded) return;

    const supabase = safeClient();
    if (!supabase) return;
    const channel = safeOnPostgresChanges(
      supabase.channel(RANKING_TICK_CHANNEL),
      { event: 'UPDATE', schema: 'public', table: 'ranking_tick' },
      () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setRankingVersion((v) => v + 1);
          setRealtimeActive(true);
        }, RANKING_DEBOUNCE_MS);
      },
    );
    if (!channel) return;
    safeSubscribe(channel, (status) => {
      // MAI attivare il realtime dal solo status di socket: solo un evento reale
      // consegnato (RLS) prova che il canale funziona. Fuori da SUBSCRIBED si
      // torna al polling di fallback.
      if (status !== 'SUBSCRIBED') setRealtimeActive(false);
    });

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setRealtimeActive(false);
    };
  }, [visible, rankingNeeded]);

  const acquireRanking = useCallback(() => {
    rankingDemand.current += 1;
    if (rankingDemand.current === 1) setRankingNeeded(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      rankingDemand.current = Math.max(0, rankingDemand.current - 1);
      if (rankingDemand.current === 0) setRankingNeeded(false);
    };
  }, []);

  const value = useMemo<RealtimeContextType>(
    () => ({
      votingEnabled,
      votingEnabledLoaded,
      rankingVersion,
      realtimeActive,
      visible,
      acquireRanking,
    }),
    [votingEnabled, votingEnabledLoaded, rankingVersion, realtimeActive, visible, acquireRanking],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextType {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

/**
 * Registra un consumer del canale `ranking_tick` finché `enabled` è true.
 * Il canale viene condiviso (un solo subscribe) e chiuso quando l'ultimo
 * consumer si disiscrive o la scheda va in background.
 */
export function useRankingTick(enabled: boolean): void {
  const { acquireRanking } = useRealtime();
  useEffect(() => {
    if (!enabled) return;
    return acquireRanking();
  }, [enabled, acquireRanking]);
}
