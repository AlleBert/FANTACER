'use client';

import { useState, useEffect, useRef, useId, type KeyboardEvent } from 'react';
import { useVote } from '@/lib/VoteContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtime } from '@/lib/RealtimeContext';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Loader2, X } from 'lucide-react';
import { LiquidFillButton } from '@/components/voting/liquid-fill-button';
import { getVoteSecurity, getVisitorId } from '@/lib/vote-security';
import { ensureVoterId } from '@/lib/vote-client-identity';
import { TurnstileOverlay } from '@/components/voting/turnstile-overlay';
import { MessageOverlay } from '@/components/voting/message-overlay';
import { FairEndCard } from '@/components/voting/fair-end-card';
import { useFairEndPhase } from '@/hooks/use-fair-end-phase';
import { ModalShell } from '@/components/ui/modal-shell';
import { SectionFrame } from '@/components/layout/section-frame';
import { useLocale } from '@/lib/LocaleContext';
import { setStoredVoterId } from '@/lib/vote-persistence';

const supabase = createClient();

const PALLET_OPTIONS = [4, 2, 1] as const;

interface CompanyResult {
  id: string;
  name: string;
}

export function SearchSection() {
  const { t } = useLocale();
  const { selectedCompanies, setCompany, removeCompany, setPallet, usedPallets, unlockGameStep, gameUnlock } = useVote();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState<4 | 2 | 1 | null>(null);
  const [showPalletPicker, setShowPalletPicker] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<CompanyResult | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { votingEnabled, antibotEnabled, fairEndEnabled, fairEndRevealAt, fairEndCeremony } = useRealtime();
  const fairEndPhase = useFairEndPhase();
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const listboxId = useId();

  useEffect(() => {
    fetch('/api/public/batch')
      .then(res => res.json())
      .then(data => setActiveBatch(data.activeBatch))
      .catch(() => setActiveBatch('TEST'));
  }, []);

  const fetchCompanies = useDebouncedCallback(async (term: string) => {
    if (!term || term.length < 2 || !activeBatch) {
      setResults([]);
      return;
    }
    setSearchLoading(true);
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('batch', activeBatch)
      .ilike('name', `%${term}%`)
      .limit(showAll ? 50 : 4);
    setResults(data || []);
    setActiveIndex(-1);
    setSearchLoading(false);
  }, 300);

  useEffect(() => {
    if (activeBatch && searchTerm.length >= 2) {
      fetchCompanies(searchTerm);
    }
  }, [activeBatch, fetchCompanies, searchTerm]);

  // Warm-up del visitorId: `fp.get()` è CPU-heavy (~1-2s su device lenti).
  // Anticiparlo al primo input utile (o alla prima azienda scelta) evita di
  // sommarlo al submit, quando la rete è già satura.
  const startedVoting = selectedCompanies.length > 0;
  useEffect(() => {
    if (!votingEnabled || antibotEnabled || fairEndEnabled) return;
    if (searchTerm.length < 2 && !startedVoting) return;
    getVisitorId().catch(() => {});
    ensureVoterId().catch(() => {});
  }, [votingEnabled, antibotEnabled, fairEndEnabled, searchTerm.length, startedVoting]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setActiveIndex(-1);
    fetchCompanies(term);
  };

  const handleSelectCompany = (company: CompanyResult) => {
    if (selectedCompanies.some((c) => c.company.id === company.id)) return;
    const used = usedPallets();
    const available = PALLET_OPTIONS.filter((p) => !used.includes(p));
    if (available.length === 0 || selectedCompanies.length >= 3) return;

    // Chiude la tastiera prima di aprire il modal: altrimenti il focus trap
    // ripristinerebbe il focus sull'input alla chiusura, riaprendo la tastiera.
    inputRef.current?.blur();
    setPendingCompany(company);
    setSelectedPallet(available[0]);
    setShowPalletPicker(true);
    setResults([]);
    setActiveIndex(-1);
    setSearchTerm('');
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 >= results.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelectCompany(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setResults([]);
      setActiveIndex(-1);
    }
  };

  const handleConfirmPallet = () => {
    if (!pendingCompany || !selectedPallet) return;
    if (editingIndex !== null) {
      setPallet(editingIndex, selectedPallet);
      setEditingIndex(null);
    } else {
      setCompany(pendingCompany, selectedPallet);
    }
    setShowPalletPicker(false);
    setPendingCompany(null);
  };

  const handleEditPallet = (index: number) => {
    const item = selectedCompanies[index];
    inputRef.current?.blur();
    setEditingIndex(index);
    setSelectedPallet(item.pallet);
    setShowPalletPicker(true);
  };

  const handleSubmit = () => {
    if (selectedCompanies.length === 3) {
      setShowTurnstile(true);
    }
  };

  const handleVoteSubmit = async (token: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowTurnstile(false);
    setLoading(true);
    try {
      const security = await getVoteSecurity(token);
      const res = await fetch('/api/vota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company1Id: selectedCompanies[0].company.id,
          company2Id: selectedCompanies[1].company.id,
          company3Id: selectedCompanies[2].company.id,
          turnstile_token: security.turnstile_token,
          botd: security.botd,
          visitorId: security.visitorId,
          voterId: security.voterId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('search.errVote'));
      }
      setStoredVoterId(security.voterId);
      unlockGameStep('success');
      setTimeout(() => {
        const main = document.querySelector('main');
        const target = main?.querySelector('[data-section="success"]') as HTMLElement | undefined;
        if (!main) return;
        // Reset di eventuali offset residui (pan orizzontale Android con la
        // tastiera) prima di centrare la success, altrimenti appare spostata.
        (document.activeElement as HTMLElement | null)?.blur?.();
        main.scrollLeft = 0;
        window.scrollTo(0, 0);
        if (target) {
          main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      // Solo su errore si sblocca: dopo un successo la selezione è definitiva.
      submittingRef.current = false;
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('search.errUnknown') });
    } finally {
      setLoading(false);
    }
  };

  const used = usedPallets();
  const availablePallets = PALLET_OPTIONS.filter((p) => !used.includes(p) || editingIndex !== null);
  const hasVoted = gameUnlock.success;
  const listOpen = results.length > 0;
  const activeOption = activeIndex >= 0 && activeIndex < results.length ? activeIndex : -1;

  return (
    <SectionFrame theme="search" grow className="text-purple">
      <div className="safe-shell flex flex-col">
        <div className="content-max mx-auto flex flex-1 w-full flex-col">

          <div className="flex-none w-full text-center pt-[clamp(0.5rem,1.5svh,1.5rem)]">
            <h2 className="text-(length:--fs-headline) font-[900] text-center tracking-tighter leading-(--lh-headline) text-[#4f03aa]">
              {t('search.title')}
            </h2>
            <p className="text-[clamp(0.875rem,2.5vw,1.125rem)] font-bold text-purple mt-[clamp(0.375rem,1vw,0.625rem)] max-w-(--measure-body) mx-auto [text-wrap:balance]">
              {t('search.instructions')}
            </p>
          </div>

          {fairEndEnabled ? (
            <FairEndCard phase={fairEndPhase} revealAt={fairEndRevealAt} ceremony={fairEndCeremony} />
          ) : antibotEnabled ? (
            <div className="flex-1 flex flex-col items-center justify-safe-center w-full max-w-2xl mx-auto gap-(--rythm-sec) py-8">
              <div className="bg-white rounded-3xl border-[3px] md:border-[4px] border-ink shadow-[6px_6px_0_#000] p-6 md:p-10 text-center max-w-lg">
                <div className="text-[clamp(2rem,6vw,3rem)] leading-none mb-3" aria-hidden="true">
                  🚫
                </div>
                <h3 className="text-[clamp(1.5rem,4vw,2.5rem)] font-[900] text-purple mb-4 leading-tight">
                  {t('antibot.title')}
                </h3>
                <p className="text-[clamp(0.9375rem,2.5vw,1.125rem)] font-bold text-ink leading-relaxed [text-wrap:balance]">
                  {t('antibot.body')}
                </p>
              </div>
            </div>
          ) : !votingEnabled ? (
            <div className="flex-1 flex flex-col items-center justify-safe-center w-full max-w-2xl mx-auto gap-(--rythm-sec) py-8">
              <div className="bg-white rounded-3xl border-[3px] md:border-[4px] border-ink shadow-[6px_6px_0_#000] p-6 md:p-10 text-center max-w-lg">
                <h3 className="text-[clamp(1.5rem,4vw,2.5rem)] font-[900] text-purple mb-4 leading-tight">
                  Quanta fretta!
                </h3>
                <p className="text-[clamp(1rem,2.5vw,1.25rem)] font-bold text-ink mb-6">
                  Ma dove corri? Le votazioni aprono durante il Cersaie!
                </p>
                <div className="bg-bright rounded-2xl border-[3px] border-ink p-4 mb-6">
                  <p className="text-[clamp(1.125rem,3vw,1.5rem)] font-black text-ink">
                    📅 Dal 21 al 25 settembre
                  </p>
                  <p className="text-[clamp(0.875rem,2vw,1rem)] font-bold text-ink mt-1">
                    Ti aspettiamo in fiera per votare le tue aziende preferite!
                  </p>
                </div>
                <p className="text-[clamp(0.875rem,2vw,1rem)] font-bold text-gray-600">
                  Nel frattempo, esplora il sito e scopri le aziende partecipanti 🎨
                </p>
              </div>
            </div>
          ) : (
            <div className="search-region flex-1 min-h-0 flex flex-col items-center justify-safe-center w-full max-w-2xl mx-auto gap-(--rythm-sec)">

              <div className="relative w-full flex flex-col items-center">
              <div className="relative w-full">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t('search.placeholder')}
                  aria-label={t('search.placeholder')}
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls={listOpen ? listboxId : undefined}
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-activedescendant={activeOption >= 0 ? `${listboxId}-opt-${activeOption}` : undefined}
                  className="w-full bg-question-blue border-[3px] md:border-[4px] border-ink rounded-full pl-8 pr-16 md:pr-24 h-[clamp(2.75rem,12svh,5rem)] md:h-[clamp(3rem,12svh,6rem)] text-[clamp(1rem,3.5vw,2rem)] md:text-[40px] font-[900] text-left shadow-[6px_6px_0_#000] placeholder:text-black/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 focus:bg-white focus:shadow-[8px_8px_0_#000] focus:-translate-y-1"
                />
                <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                  {searchLoading ? (
                    <Loader2 className="w-[clamp(1.5rem,4svh,3rem)] h-[clamp(1.5rem,4svh,3rem)] md:w-12 md:h-12 stroke-ink stroke-[3px] animate-spin" />
                  ) : (
                    <Search className="w-[clamp(1.5rem,4svh,3rem)] h-[clamp(1.5rem,4svh,3rem)] md:w-12 md:h-12 stroke-ink stroke-[3px]" />
                  )}
                </div>

                {listOpen && (
                  <div className="mt-2 w-full bg-white border-2 border-ink rounded-2xl shadow-[4px_4px_0_#000] overflow-hidden">
                    <ul
                      id={listboxId}
                      role="listbox"
                      aria-label={t('search.placeholder')}
                      className="max-h-[clamp(8rem,30svh,16rem)] overflow-y-auto no-scrollbar"
                    >
                      {results.map((company, index) => {
                        const alreadySelected = selectedCompanies.some((c) => c.company.id === company.id);
                        const active = index === activeOption;
                        return (
                          <li
                            key={company.id}
                            id={`${listboxId}-opt-${index}`}
                            role="option"
                            aria-selected={active}
                            aria-disabled={alreadySelected}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => !alreadySelected && handleSelectCompany(company)}
                            className={`p-3 border-b-2 border-ink last:border-b-0 transition-colors cursor-pointer ${
                              alreadySelected
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : active
                                  ? 'bg-question-blue'
                                  : ''
                            }`}
                          >
                            {company.name}
                            {alreadySelected && <span className="ml-2 text-sm">{t('search.alreadySelected')}</span>}
                          </li>
                        );
                      })}
                    </ul>
                    {!showAll && results.length >= 4 && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setShowAll(true); fetchCompanies(searchTerm); }}
                        className="w-full text-purple cursor-pointer font-[700] text-center p-3 border-t-2 border-ink hover:bg-question-blue transition-colors"
                      >
                        {t('search.viewAll')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <ModalShell
                open={showPalletPicker && pendingCompany !== null}
                onClose={() => { setShowPalletPicker(false); setEditingIndex(null); }}
                labelledBy="pallet-picker-title"
                className="bg-white rounded-3xl border-[3px] border-ink shadow-[6px_6px_0_#000] p-6 max-w-sm w-full"
              >
                <h3 id="pallet-picker-title" className="text-xl font-black text-center mb-4">
                  {editingIndex !== null ? t('search.changePallet') : t('search.assignPallet')}
                </h3>
                {pendingCompany && (
                  <>
                    <p className="text-lg font-bold text-center text-purple mb-6">{pendingCompany.name}</p>
                    <div className="flex justify-center gap-4">
                      {availablePallets.map((pallet) => (
                        <button
                          key={pallet}
                          onClick={() => setSelectedPallet(pallet)}
                          className={`w-20 h-20 rounded-full border-[3px] border-ink font-black text-2xl shadow-[3px_3px_0_#000] transition-all hover:-translate-y-1 ${
                            selectedPallet === pallet
                              ? 'bg-bright scale-110'
                              : 'bg-white'
                          }`}
                        >
                          {pallet}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-4">pallet</p>
                    <button
                      onClick={handleConfirmPallet}
                      disabled={!selectedPallet}
                      className="mt-6 w-full bg-purple text-white font-black py-3 rounded-full border-[3px] border-ink shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                      {t('search.confirm')}
                    </button>
                  </>
                )}
              </ModalShell>
            </div>

            {selectedCompanies.length > 0 && (
              <div className="w-full">
                <div className="bg-white rounded-2xl border-[3px] border-ink shadow-[4px_4px_0_#000] overflow-hidden">
                  {selectedCompanies.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-4 border-b-2 border-ink last:border-b-0"
                    >
                      <span className="truncate flex-1 min-w-0 text-lg font-black text-[#4f03aa]">
                        {item.company.name}
                      </span>
                      <div className="flex items-center gap-2 flex-none shrink-0">
                        <button
                          onClick={() => handleEditPallet(index)}
                          disabled={hasVoted}
                          className="bg-bright min-h-11 px-4 py-2 rounded-full border-2 border-ink font-black text-sm whitespace-nowrap text-black hover:bg-[#ffe066] transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-bright"
                        >
                          {t('search.palletBadge', { count: item.pallet })}
                        </button>
                        {!hasVoted && (
                          <button
                            onClick={() => removeCompany(index)}
                            aria-label={t('search.removeCompany')}
                            className="flex items-center justify-center w-11 h-11 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-6 h-6 stroke-[3]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {votingEnabled && !antibotEnabled && !fairEndEnabled && (
            <div className="flex-none flex flex-col items-center justify-center w-full pt-[clamp(0.75rem,1.5svh,1.5rem)]">
              {hasVoted ? (
                <button
                  type="button"
                  disabled
                  className="relative w-full max-w-sm h-[clamp(3rem,12svh,5rem)] md:h-[clamp(3.5rem,13svh,6rem)] rounded-full border-[3px] md:border-[4px] border-ink bg-bright/50 shadow-[4px_4px_0_#000] text-[clamp(1rem,3vw,1.5rem)] md:text-2xl font-[900] cursor-not-allowed select-none"
                >
                  <span className="absolute inset-0 flex items-center justify-center text-center px-8 text-[#221a00]">
                    {t('search.votedDone')}
                  </span>
                </button>
              ) : (
                <LiquidFillButton
                  step={selectedCompanies.length}
                  steps={3}
                  loading={loading}
                  label={t('search.submit')}
                  onClick={handleSubmit}
                />
              )}
              {!hasVoted && (
                <p
                  aria-live="polite"
                  className="text-center text-[clamp(0.75rem,2vw,1rem)] font-[900] text-purple mt-[clamp(0.375rem,1vw,0.5rem)]"
                >
                  {t('search.progress', { count: selectedCompanies.length })}
                </p>
              )}
              <p className="text-center text-[clamp(0.875rem,2.5vw,1.125rem)] font-bold text-purple mt-[clamp(0.5rem,1.5vw,0.75rem)] max-w-sm">
                {t('search.subtitle')}
              </p>
            </div>
          )}
        </div>
      </div>

      {showTurnstile && (
        <TurnstileOverlay
          isVisible={showTurnstile}
          onSuccess={handleVoteSubmit}
          onError={(error) => setMessage({ type: 'error', text: error })}
          onClose={() => setShowTurnstile(false)}
        />
      )}

      {message && (
        <MessageOverlay
          isVisible={true}
          type={message.type}
          title={message.type === 'success' ? t('search.msgSuccessTitle') : message.type === 'error' ? t('search.msgErrorTitle') : t('search.msgWarningTitle')}
          message={message.text}
          onClose={() => setMessage(null)}
        />
      )}
    </SectionFrame>
  );
}
