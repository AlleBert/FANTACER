'use client';

import { useState, useEffect } from 'react';
import { useVote } from '@/lib/VoteContext';
import { createClient } from '@/lib/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getVoteSecurity } from '@/lib/vote-security';
import { TurnstileOverlay } from '@/components/voting/turnstile-overlay';
import { MessageOverlay } from '@/components/voting/message-overlay';
import { useLocale } from '@/lib/LocaleContext';

const supabase = createClient();

const PALLET_OPTIONS = [4, 2, 1] as const;

interface CompanyResult {
  id: string;
  name: string;
}

export function SearchSection() {
  const { t } = useLocale();
  const { selectedCompanies, setCompany, removeCompany, setPallet, usedPallets, unlockGameStep } = useVote();
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
    setSearchLoading(false);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    fetchCompanies(term);
  };

  const handleSelectCompany = (company: CompanyResult) => {
    if (selectedCompanies.some((c) => c.company.id === company.id)) return;
    const used = usedPallets();
    const available = PALLET_OPTIONS.filter((p) => !used.includes(p));
    if (available.length === 0 || selectedCompanies.length >= 3) return;

    setPendingCompany(company);
    setSelectedPallet(available[0]);
    setShowPalletPicker(true);
    setResults([]);
    setSearchTerm('');
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('search.errVote'));
      }
      unlockGameStep('success');
      setTimeout(() => {
        const main = document.querySelector('main');
        const target = main?.querySelector('[data-section="success"]') as HTMLElement | undefined;
        if (main && target) {
          main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('search.errUnknown') });
    } finally {
      setLoading(false);
    }
  };

  const used = usedPallets();
  const availablePallets = PALLET_OPTIONS.filter((p) => !used.includes(p) || editingIndex !== null);

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(194,225,255,0.2)_0%,rgba(255,255,255,1)_100%)] text-[#8000ff]">
      <div className="safe-shell flex flex-col">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col px-4 md:px-8">

          <div className="flex-none w-full text-center pt-[clamp(0.5rem,1.5dvh,1.5rem)]">
            <h2 className="text-[clamp(2.5rem,7.5vw,91px)] font-[900] text-center tracking-tighter leading-[1.2] text-[#4f03aa]">
              {t('search.title')}
            </h2>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto gap-[clamp(1.5rem,3dvh,2.5rem)]">

            <div className="relative w-full flex flex-col items-center">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={t('search.placeholder')}
                className="w-full bg-[#c2e1ff] border-[3px] md:border-[4px] border-[#231f20] rounded-full pl-8 pr-16 md:pr-24 h-20 md:h-24 text-[clamp(1.5rem,4vw,32px)] md:text-[40px] font-[900] text-left shadow-[6px_6px_0_#000] placeholder:text-black/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 focus:bg-white focus:shadow-[8px_8px_0_#000] focus:-translate-y-1"
              />
              <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                {searchLoading ? (
                  <Loader2 className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px] animate-spin" />
                ) : (
                  <Search className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px]" />
                )}
              </div>
            </div>

            {results.length > 0 && (
              <ul className="mt-2 w-full max-w-2xl bg-white border-2 border-[#231f20] rounded-2xl shadow-[4px_4px_0_#000] max-h-64 overflow-y-auto">
                {results.map((company) => {
                  const alreadySelected = selectedCompanies.some((c) => c.company.id === company.id);
                  return (
                    <li
                      key={company.id}
                      onClick={() => !alreadySelected && handleSelectCompany(company)}
                      className={`p-3 border-b-2 border-[#231f20] last:border-b-0 transition-colors ${
                        alreadySelected
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'hover:bg-[#c2e1ff] cursor-pointer'
                      }`}
                    >
                      {company.name}
                      {alreadySelected && <span className="ml-2 text-sm">{t('search.alreadySelected')}</span>}
                    </li>
                  );
                })}
                {!showAll && results.length >= 4 && (
                  <li
                    onClick={() => { setShowAll(true); fetchCompanies(searchTerm); }}
                    className="p-3 text-[#8000ff] cursor-pointer font-[700] text-center hover:bg-[#c2e1ff] transition-colors"
                  >
                    {t('search.viewAll')}
                  </li>
                )}
              </ul>
            )}

            {showPalletPicker && pendingCompany && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowPalletPicker(false); setEditingIndex(null); }}>
                <div className="bg-white rounded-3xl border-[3px] border-[#231f20] shadow-[6px_6px_0_#000] p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-xl font-black text-center mb-4">
                    {editingIndex !== null ? t('search.changePallet') : t('search.assignPallet')}
                  </h3>
                  <p className="text-lg font-bold text-center text-[#8000ff] mb-6">{pendingCompany.name}</p>
                  <div className="flex justify-center gap-4">
                    {availablePallets.map((pallet) => (
                      <button
                        key={pallet}
                        onClick={() => setSelectedPallet(pallet)}
                        className={`w-20 h-20 rounded-full border-[3px] border-[#231f20] font-black text-2xl shadow-[3px_3px_0_#000] transition-all hover:-translate-y-1 ${
                          selectedPallet === pallet
                            ? 'bg-[#fccb27] scale-110'
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
                    className="mt-6 w-full bg-[#8000ff] text-white font-black py-3 rounded-full border-[3px] border-[#231f20] shadow-[3px_3px_0_#000] hover:shadow-[5px_5px_0_#000] hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {t('search.confirm')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedCompanies.length > 0 && (
            <div className="w-full">
              <div className="bg-white rounded-2xl border-[3px] border-[#231f20] shadow-[4px_4px_0_#000] overflow-hidden">
                {selectedCompanies.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 p-4 border-b-2 border-[#231f20] last:border-b-0"
                  >
                    <span className="truncate flex-1 min-w-0 text-lg font-black text-[#4f03aa]">
                      {item.company.name}
                    </span>
                    <div className="flex items-center gap-2 flex-none shrink-0">
                      <button
                        onClick={() => handleEditPallet(index)}
                        className="bg-[#fccb27] px-3 py-1 rounded-full border-2 border-[#231f20] font-black text-sm whitespace-nowrap text-black hover:bg-[#ffe066] transition-colors"
                      >
                        {t('search.palletBadge', { count: item.pallet })}
                      </button>
                      <button
                        onClick={() => removeCompany(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <X className="w-6 h-6 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-none flex flex-col items-center justify-center w-full pb-[var(--safe-bottom-offset)] pt-[clamp(0.75rem,1.5dvh,1.5rem)]">
          <Button
            onClick={handleSubmit}
            disabled={selectedCompanies.length < 3 || loading}
            className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('search.submit')}
          </Button>
          <p className="text-center text-base md:text-lg font-bold text-[#8000ff] mt-3 max-w-sm">
            {t('search.subtitle')}
          </p>
        </div>
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
    </section>
  );
}
