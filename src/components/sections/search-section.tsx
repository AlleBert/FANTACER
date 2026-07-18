'use client';

import { useState, useEffect } from 'react';
import { useVote } from '@/lib/VoteContext';
import { createClient } from '@/lib/supabase/client';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const supabase = createClient();

const PALLET_OPTIONS = [4, 2, 1] as const;

interface CompanyResult {
  id: string;
  name: string;
}

export function SearchSection() {
  const { selectedCompanies, setCompany, removeCompany, setPallet, usedPallets, unlockGameStep } = useVote();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState<4 | 2 | 1 | null>(null);
  const [showPalletPicker, setShowPalletPicker] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<CompanyResult | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    setLoading(true);
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('batch', activeBatch)
      .ilike('name', `%${term}%`)
      .limit(showAll ? 50 : 4);
    setResults(data || []);
    setLoading(false);
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

  const handleNext = () => {
    if (selectedCompanies.length === 3) {
      unlockGameStep('submit');
      const main = document.querySelector('main');
      const sections = main?.children;
      if (sections) {
        const submitIndex = 6;
        const target = sections[submitIndex] as HTMLElement;
        if (target) main.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }
    }
  };

  const used = usedPallets();
  const availablePallets = PALLET_OPTIONS.filter((p) => !used.includes(p) || editingIndex !== null);

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(194,225,255,0.2)_0%,rgba(255,255,255,1)_100%)] text-[#8000ff]">
      <div className="safe-shell flex">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          <h2 className="text-[clamp(2.5rem,7.5vw,91px)] font-[900] text-center mb-[clamp(3rem,8vh,5rem)] tracking-tighter lowercase leading-[1.1] md:whitespace-nowrap w-full text-[#8000ff]">
            vota la tua azienda preferita
          </h2>

          <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Cerca azienda..."
                className="w-full bg-[#c2e1ff] border-[3px] md:border-[4px] border-[#231f20] rounded-full pl-8 pr-16 md:pr-24 h-20 md:h-24 text-[clamp(1.5rem,4vw,32px)] md:text-[40px] font-[900] text-left shadow-[6px_6px_0_#000] placeholder:text-black/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 focus:bg-white focus:shadow-[8px_8px_0_#000] focus:-translate-y-1"
              />
              <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                {loading ? (
                  <Loader2 className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px] animate-spin" />
                ) : (
                  <Search className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px]" />
                )}
              </div>
            </div>

            {results.length > 0 && (
              <ul className="mt-2 w-full max-w-2xl bg-white border-2 border-[#231f20] rounded-lg shadow-[4px_4px_0_#000] max-h-64 overflow-y-auto">
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
                      {alreadySelected && <span className="ml-2 text-sm">(già selezionata)</span>}
                    </li>
                  );
                })}
                {!showAll && results.length >= 4 && (
                  <li
                    onClick={() => { setShowAll(true); fetchCompanies(searchTerm); }}
                    className="p-3 text-[#8000ff] cursor-pointer font-[700] text-center hover:bg-[#c2e1ff] transition-colors"
                  >
                    View all
                  </li>
                )}
              </ul>
            )}

            {showPalletPicker && pendingCompany && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowPalletPicker(false); setEditingIndex(null); }}>
                <div className="bg-white rounded-3xl border-[3px] border-[#231f20] shadow-[6px_6px_0_#000] p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-xl font-black text-center mb-4">
                    {editingIndex !== null ? 'Cambia pallet' : 'Assegna pallet'}
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
                    CONFERMA
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedCompanies.length > 0 && (
            <div className="w-full max-w-2xl mx-auto mt-4">
              <div className="bg-white rounded-2xl border-[3px] border-[#231f20] shadow-[4px_4px_0_#000] overflow-hidden">
                {selectedCompanies.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border-b-2 border-[#231f20] last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-[#8000ff]">{item.company.name}</span>
                      <button
                        onClick={() => handleEditPallet(index)}
                        className="bg-[#fccb27] px-3 py-1 rounded-full border-2 border-[#231f20] font-black text-sm hover:bg-[#ffe066] transition-colors"
                      >
                        {item.pallet} pallet
                      </button>
                    </div>
                    <button
                      onClick={() => removeCompany(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-6 h-6 stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-[2vh]" />

          <div className="flex justify-center w-full flex-none pb-8">
            <Button
              onClick={handleNext}
              disabled={selectedCompanies.length < 3}
              className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &gt;&gt;
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
