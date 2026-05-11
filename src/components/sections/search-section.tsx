'use client';

import { useState } from 'react';
import { useVote } from '@/lib/VoteContext';
import { createClient } from '@supabase/supabase-js';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CompanyResult {
  id: string;
  name: string;
}

export function SearchSection() {
  const { selectedCompany, setSelectedCompany, setCurrentSection, unlockGameStep } = useVote();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCompanies = useDebouncedCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${term}%`)
      .limit(showAll ? 50 : 4);
    setResults(data || []);
    setLoading(false);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    fetchCompanies(term);
    if (selectedCompany && term !== selectedCompany.name) {
      setSelectedCompany(null);
    }
  };

  const handleSelectCompany = (company: CompanyResult) => {
    setSelectedCompany(company);
    setSearchTerm(company.name);
    setResults([]);
  };

  const handleViewAll = () => {
    setShowAll(true);
    fetchCompanies(searchTerm);
  };

  const handleNext = () => {
    if (selectedCompany) {
      unlockGameStep('comment');
      const main = document.querySelector('main');
      const sections = main?.children;
      if (sections && sections[7]) {
        (sections[7] as HTMLElement).scrollIntoView({ behavior: 'smooth' });
      }
      setCurrentSection(2);
    }
  };

  return (
    <section className="snap-start relative app-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(194,225,255,0.2)_0%,rgba(255,255,255,1)_100%)] text-[#8000ff]">
      <div className="safe-shell flex">
        <div className="mx-auto flex flex-1 w-full max-w-[1200px] flex-col items-center px-4 md:px-8">
          <div className="flex-1 min-h-[4vh]" />

          {/* Main Title */}
          <h2 className="text-[clamp(2.5rem,7.5vw,91px)] font-[900] text-center mb-[clamp(3rem,8vh,5rem)] tracking-tighter lowercase leading-[1.1] md:whitespace-nowrap w-full text-[#8000ff]">
            vota la tua azienda preferita
          </h2>

          {/* Search input container */}
          <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Cerca azienda..."
                className="w-full bg-[#c2e1ff] border-[3px] md:border-[4px] border-[#231f20] rounded-full pl-8 pr-16 md:pr-24 h-20 md:h-24 text-[clamp(1.5rem,4vw,32px)] md:text-[40px] font-[900] text-left shadow-[6px_6px_0_#000] placeholder:text-black/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all duration-300 focus:bg-white focus:shadow-[8px_8px_0_#000] focus:-translate-y-1"
              />
              {/* Embedded Search Icon */}
              <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                {loading ? (
                  <Loader2 className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px] animate-spin" />
                ) : (
                  <Search className="w-8 h-8 md:w-12 md:h-12 stroke-[#231f20] stroke-[3px]" />
                )}
              </div>
            </div>

            {/* Search Results */}
            {results.length > 0 && (
              <ul className="mt-2 w-full max-w-2xl bg-white border-2 border-[#231f20] rounded-lg shadow-[4px_4px_0_#000] max-h-64 overflow-y-auto">
                {results.map((company) => (
                  <li
                    key={company.id}
                    onClick={() => handleSelectCompany(company)}
                    className="p-3 hover:bg-[#c2e1ff] cursor-pointer border-b-2 border-[#231f20] last:border-b-0 transition-colors"
                  >
                    {company.name}
                  </li>
                ))}
                {!showAll && results.length >= 4 && (
                  <li
                    onClick={handleViewAll}
                    className="p-3 text-[#8000ff] cursor-pointer font-[700] text-center hover:bg-[#c2e1ff] transition-colors"
                  >
                    View all
                  </li>
                )}
              </ul>
            )}

            
          </div>

          <div className="flex-1 min-h-[2vh]" />

          {/* Next Button */}
          <div className="flex justify-center w-full flex-none pb-8">
            <Button
              onClick={handleNext}
              disabled={!selectedCompany}
              className="bg-[#fccb27] hover:bg-[#ffe066] text-black text-2xl md:text-3xl font-[900] px-12 py-6 md:px-16 md:py-8 rounded-full border-[3px] md:border-[4px] border-[#231f20] shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-y-1 transition-all duration-300 w-full max-w-[16rem] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0_#000] disabled:hover:translate-y-0"
            >
              &gt;&gt;
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
